import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, ProductStatus, OrderStatus, PaymentStatus, CouponType } from "@prisma/client";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paymentStatus, createPaymentSession, processRefund } from "./services/payment.js";
import { shippingStatus, quoteShipping } from "./services/shipping.js";
import { calculateTax } from "./services/tax.js";
import { homepageInput, readHomepage, writeHomepage, resetHomepage } from "./services/homepage.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn("WARNING: Set JWT_SECRET to a random value of at least 32 characters before use.");
}
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://localhost:8080").split(",").map(s=>s.trim()) }));
app.use(express.json({ limit: "256kb" }));
app.use(morgan("tiny"));
app.use(express.static(path.resolve(__dirname, "../../public")));

const asyncHandler = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fail = (res, status, message) => res.status(status).json({ error: message });
const tokenFor = user => jwt.sign({ sub:user.id, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:"8h" });
function auth(req,res,next){
  const raw=req.headers.authorization||"";
  if(!raw.startsWith("Bearer ")) return fail(res,401,"Authentication required");
  try { req.user=jwt.verify(raw.slice(7),JWT_SECRET); next(); }
  catch { return fail(res,401,"Invalid or expired token"); }
}
function roles(...allowed){return (req,res,next)=>allowed.includes(req.user.role)?next():fail(res,403,"Insufficient permissions");}
const audit = (req,action,entityType,entityId,metadata={}) => prisma.auditLog.create({data:{adminUserId:req.user?.sub,action,entityType,entityId,metadata,ipAddress:req.ip}}).catch(()=>{});
const productInput=z.object({name:z.string().min(2),slug:z.string().min(2).regex(/^[a-z0-9-]+$/),description:z.string().optional(),categoryId:z.string(),status:z.nativeEnum(ProductStatus).optional(),basePrice:z.coerce.number().positive(),currency:z.string().length(3).default("USD"),imageUrl:z.union([z.literal(""),z.string().max(2048).refine(v=>/^https?:\/\//i.test(v)||(v.startsWith("/")&&!v.split("/").includes("..")),{message:"imageUrl must be an http(s) URL or a local path such as /images/photo.jpg"})]).optional(),position:z.coerce.number().int().min(0).max(9999).optional(),tags:z.array(z.string()).optional()});
const orderStatusInput=z.object({status:z.nativeEnum(OrderStatus),trackingNumber:z.string().optional(),carrier:z.string().optional(),notes:z.string().optional()});
app.get("/health", (req,res)=>res.json({status:"ok",service:"forme-api",timestamp:new Date().toISOString()}));
const loginAttempts = new Map();
app.post("/api/auth/login", (req,res,next)=>{
  const key = `${req.ip}:${String(req.body?.email || "").toLowerCase()}`;
  const entry = loginAttempts.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 10) return fail(res,429,"Too many login attempts. Try again in 15 minutes.");
  req.loginAttemptKey = key; next();
}, asyncHandler(async(req,res)=>{
  const schema=z.object({email:z.string().email(),password:z.string().min(1)});
  const parsed=schema.safeParse(req.body); if(!parsed.success)return fail(res,400,"Valid email and password are required");
  const user=await prisma.adminUser.findUnique({where:{email:parsed.data.email.toLowerCase()}});
  if(!user||!user.active||!(await bcrypt.compare(parsed.data.password,user.passwordHash))){
    const key=req.loginAttemptKey; const old=loginAttempts.get(key); const fresh=!old||old.until<Date.now(); loginAttempts.set(key,{count:fresh?1:old.count+1,until:fresh?Date.now()+900000:old.until}); return fail(res,401,"Invalid credentials");
  }
  loginAttempts.delete(req.loginAttemptKey);
  await prisma.adminUser.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
  res.json({token:tokenFor(user),user:{id:user.id,email:user.email,name:user.name,role:user.role}});
}));
app.get("/api/auth/me",auth,asyncHandler(async(req,res)=>{const user=await prisma.adminUser.findUnique({where:{id:req.user.sub},select:{id:true,email:true,name:true,role:true,active:true}});if(!user)return fail(res,401,"User not found");res.json({user})}));

app.get("/api/store/categories",asyncHandler(async(req,res)=>res.json(await prisma.category.findMany({orderBy:{name:"asc"}}))));
app.get("/api/store/homepage",asyncHandler(async(req,res)=>res.json(await readHomepage(prisma))));
app.get("/api/store/products",asyncHandler(async(req,res)=>{
 const {category,search,page="1",limit="24"}=req.query;const take=Math.min(100,Math.max(1,Number(limit)||24)),skip=(Math.max(1,Number(page)||1)-1)*take;
 const where={status:"ACTIVE",...(category?{category:{slug:String(category)}}:{}),...(search?{OR:[{name:{contains:String(search),mode:"insensitive"}},{description:{contains:String(search),mode:"insensitive"}}]}:{})};
 const [items,total]=await Promise.all([prisma.product.findMany({where,include:{category:true,variants:{include:{inventory:true}}},orderBy:[{position:"asc"},{createdAt:"asc"}],skip,take}),prisma.product.count({where})]);
 res.json({items,total,page:Number(page)||1,limit:take});
}));
app.get("/api/store/products/:slug",asyncHandler(async(req,res)=>{const p=await prisma.product.findUnique({where:{slug:req.params.slug},include:{category:true,variants:{include:{inventory:true}}}});if(!p||p.status!=="ACTIVE")return fail(res,404,"Product not found");res.json(p)}));

app.post("/api/store/checkout",asyncHandler(async(req,res)=>{
 const schema=z.object({email:z.string().email(),currency:z.string().length(3).default("USD"),shippingAddress:z.object({firstName:z.string().min(1),lastName:z.string().min(1),address1:z.string().min(2),address2:z.string().optional(),city:z.string().min(1),region:z.string().optional(),postalCode:z.string().min(2),countryCode:z.string().length(2),phone:z.string().optional()}),items:z.array(z.object({variantId:z.string().min(1),quantity:z.number().int().min(1).max(20)})).min(1).max(50),couponCode:z.string().optional()});
 const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid checkout details",details:parsed.error.flatten()});
 const input=parsed.data;
 const result=await prisma.$transaction(async tx=>{
  const ids=input.items.map(i=>i.variantId);if(new Set(ids).size!==ids.length)throw Object.assign(new Error("Duplicate variant IDs are not allowed"),{status:400});
  const variants=await tx.productVariant.findMany({where:{id:{in:ids},product:{status:"ACTIVE"}},include:{product:true,inventory:true}});
  if(variants.length!==input.items.length)throw Object.assign(new Error("One or more products are unavailable"),{status:409});
  let subtotal=0;const lineItems=[];
  for(const item of input.items){const variant=variants.find(v=>v.id===item.variantId);if(!variant.inventory)throw Object.assign(new Error(`Inventory is not configured for ${variant.sku}`),{status:409});if(variant.product.currency!==input.currency)throw Object.assign(new Error(`Currency conversion is not configured for ${variant.product.name}; use ${variant.product.currency}`),{status:400});const available=variant.inventory.onHand-variant.inventory.reserved;if(available<item.quantity)throw Object.assign(new Error(`Insufficient stock for ${variant.product.name}`),{status:409});const price=Number(variant.priceOverride??variant.product.basePrice);subtotal+=price*item.quantity;lineItems.push({variant,item,price,lineTotal:price*item.quantity});}
  let coupon=null,discount=0;if(input.couponCode){coupon=await tx.coupon.findUnique({where:{code:input.couponCode.toUpperCase()}});const now=new Date();if(!coupon||!coupon.active||(coupon.startsAt&&coupon.startsAt>now)||(coupon.expiresAt&&coupon.expiresAt<now)||(coupon.usageLimit!==null&&coupon.usageCount>=coupon.usageLimit)||subtotal<Number(coupon.minSpend||0)||coupon.currency!==input.currency)throw Object.assign(new Error("Coupon is invalid or not applicable"),{status:400});discount=coupon.type==="PERCENTAGE"?subtotal*Number(coupon.value)/100:Number(coupon.value);discount=Math.min(subtotal,discount);}
  const customer=await tx.customer.upsert({where:{email:input.email.toLowerCase()},update:{firstName:input.shippingAddress.firstName,lastName:input.shippingAddress.lastName,countryCode:input.shippingAddress.countryCode},create:{email:input.email.toLowerCase(),firstName:input.shippingAddress.firstName,lastName:input.shippingAddress.lastName,countryCode:input.shippingAddress.countryCode}});
  const order=await tx.order.create({data:{orderNumber:`FM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,customerId:customer.id,email:input.email.toLowerCase(),currency:input.currency,subtotal,discountTotal:discount,shippingTotal:0,taxTotal:0,grandTotal:Math.max(0,subtotal-discount),shippingAddress:input.shippingAddress,couponId:coupon?.id,notes:"Payment not collected. Shipping and tax are not yet configured.",items:{create:lineItems.map(({variant,item,price,lineTotal})=>({productId:variant.productId,variantId:variant.id,productName:variant.product.name,sku:variant.sku,quantity:item.quantity,unitPrice:price,lineTotal}))}}});
  for(const {variant,item} of lineItems){const updated=await tx.inventory.updateMany({where:{id:variant.inventory.id,onHand:variant.inventory.onHand,reserved:{lte:variant.inventory.onHand-item.quantity}},data:{reserved:{increment:item.quantity}}});if(updated.count!==1)throw Object.assign(new Error("Stock changed during checkout; please try again"),{status:409});await tx.inventoryMovement.create({data:{inventoryId:variant.inventory.id,type:"RESERVATION",quantity:item.quantity,reference:order.id,note:"Checkout reservation pending payment"}});}
  if(coupon)await tx.coupon.update({where:{id:coupon.id},data:{usageCount:{increment:1}}});
  return {orderNumber:order.orderNumber,status:order.status,paymentStatus:order.paymentStatus,currency:order.currency,subtotal:order.subtotal,discountTotal:order.discountTotal,shippingTotal:order.shippingTotal,taxTotal:order.taxTotal,grandTotal:order.grandTotal,message:"Order created without payment. Configure a payment provider before accepting live orders."};
 });res.status(201).json(result);
}));

// Integration readiness endpoints deliberately report disabled providers until credentials and verified callbacks exist.
app.get("/api/integrations/status",(req,res)=>res.json({payments:paymentStatus(),shipping:shippingStatus(),tax:{configured:false,mode:"reviewed-rules-only",message:"Only active merchant-reviewed tax rules are used for estimates; legal/tax review required."},email:{configured:Boolean(process.env.EMAIL_PROVIDER_API_KEY),mode:process.env.EMAIL_PROVIDER_API_KEY?"credentials-present":"disabled"}}));
app.post("/api/store/shipping-quote",asyncHandler(async(req,res)=>res.json(await quoteShipping(req.body||{}))));
app.post("/api/store/tax-quote",asyncHandler(async(req,res)=>res.json(await calculateTax(prisma,req.body||{}))));
app.post("/api/store/payment-session",asyncHandler(async(req,res)=>{ await createPaymentSession(req.body); res.status(501).json({error:"Payment provider unavailable"}); }));
app.post("/api/store/returns",asyncHandler(async(req,res)=>{
 const p=z.object({orderNumber:z.string().min(3),email:z.string().email(),reason:z.string().min(3).max(120),customerNote:z.string().max(1000).optional(),items:z.array(z.object({orderItemId:z.string(),quantity:z.number().int().positive()})).min(1)}).safeParse(req.body);
 if(!p.success)return res.status(400).json({error:"Invalid return request",details:p.error.flatten()});
 const order=await prisma.order.findFirst({where:{orderNumber:p.data.orderNumber,email:p.data.email.toLowerCase()},include:{items:true}});
 if(!order)return fail(res,404,"Order not found for supplied order number and email");
 if(!["PAID","PROCESSING","SHIPPED","DELIVERED"].includes(order.status))return fail(res,409,"Order is not eligible for a return request in its current status");
 for(const item of p.data.items){const line=order.items.find(x=>x.id===item.orderItemId);if(!line||item.quantity>line.quantity)return fail(res,400,"Return item or quantity is invalid");}
 const total=p.data.items.reduce((sum,item)=>{const line=order.items.find(x=>x.id===item.orderItemId);return sum+Number(line.unitPrice)*item.quantity;},0);
 const created=await prisma.returnRequest.create({data:{returnNumber:`RET-${Date.now().toString(36).toUpperCase()}`,orderId:order.id,email:order.email,reason:p.data.reason,customerNote:p.data.customerNote,items:p.data.items,requestedRefund:total}});
 res.status(201).json({returnNumber:created.returnNumber,status:created.status,requestedRefund:total,currency:order.currency,message:"Return request recorded. It is not approved and no refund has been issued."});
}));

app.use("/api/admin",auth);
app.get("/api/admin/returns",roles("ADMIN","MANAGER","SUPPORT"),asyncHandler(async(req,res)=>res.json(await prisma.returnRequest.findMany({include:{order:{select:{orderNumber:true,currency:true,status:true}},},orderBy:{createdAt:"desc"},take:200}))));
app.patch("/api/admin/returns/:id",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const p=z.object({status:z.enum(["APPROVED","REJECTED","RECEIVED","CLOSED"]),resolutionNote:z.string().max(1000).optional()}).safeParse(req.body);if(!p.success)return fail(res,400,"Invalid return status");
 const ret=await prisma.returnRequest.update({where:{id:req.params.id},data:{status:p.data.status,resolutionNote:p.data.resolutionNote}});await audit(req,"UPDATE_RETURN","ReturnRequest",ret.id,{status:ret.status});res.json(ret);
}));
app.get("/api/admin/refunds",roles("ADMIN","MANAGER","SUPPORT"),asyncHandler(async(req,res)=>res.json(await prisma.refund.findMany({include:{order:{select:{orderNumber:true,email:true}},},orderBy:{createdAt:"desc"},take:200}))));
app.post("/api/admin/orders/:id/refunds",roles("ADMIN"),asyncHandler(async(req,res)=>{
 const p=z.object({amount:z.coerce.number().positive(),reason:z.string().min(3).max(500),returnRequestId:z.string().optional()}).safeParse(req.body);if(!p.success)return fail(res,400,"Invalid refund request");
 const order=await prisma.order.findUnique({where:{id:req.params.id}});if(!order)return fail(res,404,"Order not found");if(order.paymentStatus!=="PAID")return fail(res,409,"Only paid orders can be refunded");if(p.data.amount>Number(order.grandTotal))return fail(res,400,"Refund exceeds order total");
 const refund=await prisma.refund.create({data:{orderId:order.id,returnRequestId:p.data.returnRequestId,amount:p.data.amount,currency:order.currency,reason:p.data.reason,status:"REQUESTED"}});await audit(req,"REFUND_REQUESTED","Refund",refund.id,{amount:p.data.amount});
 res.status(202).json({refund,status:refund.status,message:"Refund request recorded only. No money has been sent; configure and verify a payment provider to execute refunds."});
}));
app.get("/api/admin/shipments",roles("ADMIN","MANAGER","SUPPORT"),asyncHandler(async(req,res)=>res.json(await prisma.shipment.findMany({include:{order:{select:{orderNumber:true,email:true}},},orderBy:{createdAt:"desc"},take:200}))));
app.post("/api/admin/orders/:id/shipments",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const p=z.object({fulfillmentType:z.enum(["OWN_WAREHOUSE","SUPPLIER_DROPSHIP","OVERSEAS_WAREHOUSE"]),warehouseCode:z.string().optional(),supplierReference:z.string().optional(),carrier:z.string().optional(),trackingNumber:z.string().optional(),trackingUrl:z.string().url().optional()}).safeParse(req.body);if(!p.success)return fail(res,400,"Invalid shipment data");
 const order=await prisma.order.findUnique({where:{id:req.params.id}});if(!order)return fail(res,404,"Order not found");
 const shipment=await prisma.shipment.create({data:{orderId:order.id,...p.data,status:p.data.trackingNumber?"IN_TRANSIT":"PENDING"}});await audit(req,"CREATE_SHIPMENT_RECORD","Shipment",shipment.id,{fulfillmentType:shipment.fulfillmentType});res.status(201).json({shipment,message:"Shipment record created. No carrier label was purchased and tracking is not provider-verified."});
}));
app.get("/api/admin/tax-rules",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>res.json(await prisma.taxRule.findMany({orderBy:[{countryCode:"asc"},{regionCode:"asc"}]}))));
app.post("/api/admin/tax-rules",roles("ADMIN"),asyncHandler(async(req,res)=>{
 const p=z.object({name:z.string().min(2),countryCode:z.string().length(2).transform(v=>v.toUpperCase()),regionCode:z.string().optional(),postalPrefix:z.string().optional(),rate:z.coerce.number().min(0).max(1),inclusive:z.boolean().default(false),active:z.boolean().default(false),source:z.string().default("MANUAL_UNVERIFIED")}).safeParse(req.body);if(!p.success)return fail(res,400,"Invalid tax rule");
 const rule=await prisma.taxRule.create({data:p.data});await audit(req,"CREATE_TAX_RULE","TaxRule",rule.id,{countryCode:rule.countryCode,active:rule.active});res.status(201).json(rule);
}));
app.patch("/api/admin/tax-rules/:id",roles("ADMIN"),asyncHandler(async(req,res)=>{const p=z.object({active:z.boolean(),source:z.string().optional()}).safeParse(req.body);if(!p.success)return fail(res,400,"active boolean required");const rule=await prisma.taxRule.update({where:{id:req.params.id},data:p.data});await audit(req,"UPDATE_TAX_RULE","TaxRule",rule.id,{active:rule.active});res.json(rule);}));

app.get("/api/admin/dashboard",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const [orders,products,customers,inventoryRows,revenue,recentOrders]=await Promise.all([
 prisma.order.count(),prisma.product.count({where:{status:"ACTIVE"}}),prisma.customer.count(),
 prisma.inventory.findMany({select:{onHand:true,reorderPoint:true}}),
 prisma.order.aggregate({where:{paymentStatus:"PAID"},_sum:{grandTotal:true}}),
 prisma.order.findMany({take:8,orderBy:{createdAt:"desc"},include:{customer:true,items:true}})
 ]);
 const lowStock=inventoryRows.filter(row=>row.onHand<=row.reorderPoint).length;
 res.json({metrics:{orders,activeProducts:products,customers,lowStockItems:lowStock,paidRevenue:revenue._sum.grandTotal||0},recentOrders});
}));
app.get("/api/admin/products",roles("ADMIN","MANAGER","SUPPORT"),asyncHandler(async(req,res)=>{
 const {search,status}=req.query;const where={...(status?{status:String(status)}:{}),...(search?{OR:[{name:{contains:String(search),mode:"insensitive"}},{slug:{contains:String(search),mode:"insensitive"}}]}:{})};
 res.json(await prisma.product.findMany({where,include:{category:true,variants:{include:{inventory:true}}},orderBy:{updatedAt:"desc"}}));
}));
app.post("/api/admin/products",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const p=productInput.safeParse(req.body);if(!p.success)return res.status(400).json({error:"Invalid product",details:p.error.flatten()});
 const created=await prisma.product.create({data:{...p.data,imageUrl:p.data.imageUrl||null},include:{category:true}});await audit(req,"CREATE","Product",created.id,{slug:created.slug});res.status(201).json(created);
}));
app.patch("/api/admin/products/:id",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const existing=await prisma.product.findUnique({where:{id:req.params.id}});if(!existing)return fail(res,404,"Product not found");
 const parsed=productInput.partial().safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid product",details:parsed.error.flatten()});
 const updated=await prisma.product.update({where:{id:req.params.id},data:parsed.data,include:{category:true}});await audit(req,"UPDATE","Product",updated.id);res.json(updated);
}));
app.delete("/api/admin/products/:id",roles("ADMIN"),asyncHandler(async(req,res)=>{
 const existing=await prisma.product.findUnique({where:{id:req.params.id}});if(!existing)return fail(res,404,"Product not found");
 const updated=await prisma.product.update({where:{id:req.params.id},data:{status:"ARCHIVED"}});await audit(req,"ARCHIVE","Product",updated.id);res.json({ok:true,product:updated});
}));
app.get("/api/admin/homepage",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>res.json(await readHomepage(prisma))));
app.patch("/api/admin/homepage",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const parsed=homepageInput.partial().safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid homepage content",details:parsed.error.flatten()});
 const data=parsed.data;if(Object.keys(data).length===0)return fail(res,400,"Nothing to update");
 const updated=await writeHomepage(prisma,data);
 await audit(req,"UPDATE","Homepage","1",data);res.json(updated);
}));
app.post("/api/admin/homepage/reset",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const updated=await resetHomepage(prisma);
 await audit(req,"RESET","Homepage","1");res.json(updated);
}));
app.get("/api/admin/orders",roles("ADMIN","MANAGER","SUPPORT"),asyncHandler(async(req,res)=>{
 const {status,search}=req.query;const where={...(status?{status:String(status)}:{}),...(search?{OR:[{orderNumber:{contains:String(search),mode:"insensitive"}},{email:{contains:String(search),mode:"insensitive"}}]}:{})};
 res.json(await prisma.order.findMany({where,include:{customer:true,items:{include:{product:true,variant:true}}},orderBy:{createdAt:"desc"},take:200}));
}));
app.patch("/api/admin/orders/:id",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const parsed=orderStatusInput.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid order update",details:parsed.error.flatten()});
 const order=await prisma.order.findUnique({where:{id:req.params.id}});if(!order)return fail(res,404,"Order not found");
 const data={status:parsed.data.status,...(parsed.data.trackingNumber!==undefined?{trackingNumber:parsed.data.trackingNumber}:{}),...(parsed.data.carrier!==undefined?{carrier:parsed.data.carrier}:{}),...(parsed.data.notes!==undefined?{notes:parsed.data.notes}:{})};
 const updated=await prisma.order.update({where:{id:order.id},data});await audit(req,"UPDATE_STATUS","Order",order.id,{status:updated.status});res.json(updated);
}));
app.get("/api/admin/customers",roles("ADMIN","MANAGER","SUPPORT"),asyncHandler(async(req,res)=>{
 const {search}=req.query;const where=search?{OR:[{email:{contains:String(search),mode:"insensitive"}},{firstName:{contains:String(search),mode:"insensitive"}},{lastName:{contains:String(search),mode:"insensitive"}}]}:{};
 const customers=await prisma.customer.findMany({where,include:{_count:{select:{orders:true}}},orderBy:{createdAt:"desc"},take:250});res.json(customers);
}));
app.get("/api/admin/inventory",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const rows=await prisma.inventory.findMany({include:{variant:{include:{product:true}}},orderBy:{updatedAt:"desc"}});res.json(rows);
}));
app.post("/api/admin/inventory/:id/adjust",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const schema=z.object({quantity:z.number().int(),note:z.string().max(500).optional()});const p=schema.safeParse(req.body);if(!p.success)return fail(res,400,"quantity integer required");
 const result=await prisma.$transaction(async tx=>{const inv=await tx.inventory.findUnique({where:{id:req.params.id}});if(!inv)throw Object.assign(new Error("Inventory record not found"),{status:404});const next=inv.onHand+p.data.quantity;if(next<inv.reserved)throw Object.assign(new Error("On-hand stock cannot be less than reserved stock"),{status:409});const updated=await tx.inventory.update({where:{id:inv.id},data:{onHand:next}});await tx.inventoryMovement.create({data:{inventoryId:inv.id,type:"ADJUSTMENT",quantity:p.data.quantity,note:p.data.note||"Admin adjustment"}});return updated});await audit(req,"ADJUST_STOCK","Inventory",result.id,{delta:p.data.quantity});res.json(result);
}));
app.get("/api/admin/coupons",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>res.json(await prisma.coupon.findMany({orderBy:{createdAt:"desc"}}))));
app.post("/api/admin/coupons",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const schema=z.object({code:z.string().min(3).transform(s=>s.toUpperCase()),type:z.nativeEnum(CouponType),value:z.coerce.number().positive(),currency:z.string().length(3).default("USD"),minSpend:z.coerce.number().nonnegative().optional(),usageLimit:z.coerce.number().int().positive().optional(),expiresAt:z.coerce.date().optional(),active:z.boolean().default(true)});
 const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json({error:"Invalid coupon",details:p.error.flatten()});
 const c=await prisma.coupon.create({data:{...p.data,value:p.data.value,minSpend:p.data.minSpend??null,usageLimit:p.data.usageLimit??null,expiresAt:p.data.expiresAt??null}});await audit(req,"CREATE","Coupon",c.id,{code:c.code});res.status(201).json(c);
}));
app.get("/api/admin/reports/summary",roles("ADMIN","MANAGER"),asyncHandler(async(req,res)=>{
 const days=Math.min(365,Math.max(7,Number(req.query.days)||30));const since=new Date(Date.now()-days*86400000);
 const [paid,orders,topItems]=await Promise.all([
 prisma.order.aggregate({where:{createdAt:{gte:since},paymentStatus:"PAID"},_sum:{grandTotal:true,subtotal:true},_count:{id:true}}),
 prisma.order.groupBy({by:["status"],where:{createdAt:{gte:since}},_count:{id:true}}),
 prisma.orderItem.groupBy({by:["productId","productName"],where:{order:{createdAt:{gte:since},paymentStatus:"PAID"}},_sum:{quantity:true,lineTotal:true},orderBy:{_sum:{lineTotal:"desc"}},take:10})
 ]);
 res.json({periodDays:days,paidRevenue:paid._sum.grandTotal||0,paidSubtotal:paid._sum.subtotal||0,paidOrders:paid._count.id,ordersByStatus:orders,topItems});
}));
app.get("/api/admin/audit",roles("ADMIN"),asyncHandler(async(req,res)=>res.json(await prisma.auditLog.findMany({take:100,orderBy:{createdAt:"desc"}}))));

app.use((req,res)=>res.status(404).json({error:"Route not found"}));
app.use((err,req,res,next)=>{console.error(err);const status=err.status|| (err.code==="P2002"?409:500);res.status(status).json({error:status===500?"Internal server error":err.message});});
async function bootstrap(){
 try{
  if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){
   const email=process.env.ADMIN_EMAIL.toLowerCase();
   const existing=await prisma.adminUser.findUnique({where:{email}});
   if(!existing){const passwordHash=await bcrypt.hash(process.env.ADMIN_PASSWORD,12);await prisma.adminUser.create({data:{email,passwordHash,name:"Store Administrator",role:"ADMIN"}});console.log(`Bootstrap admin created for ${email}`)}
  }
  if(process.env.NODE_ENV === "production" && (!JWT_SECRET || JWT_SECRET.length < 32)) throw new Error("Production requires JWT_SECRET of at least 32 characters");
  app.listen(PORT,()=>console.log(`FORME API listening on http://localhost:${PORT}`));
 }catch(e){console.error("Startup failed. Check DATABASE_URL and run Prisma setup.",e);process.exit(1)}
}
process.on("SIGINT",async()=>{await prisma.$disconnect();process.exit(0)});
process.on("SIGTERM",async()=>{await prisma.$disconnect();process.exit(0)});
bootstrap();
