import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
async function main(){
 const cats=[
  {name:"Clothing",slug:"clothing"},{name:"Shoes",slug:"shoes"},{name:"Bags",slug:"bags"},{name:"Accessories",slug:"accessories"}
 ];
 for(const c of cats)await prisma.category.upsert({where:{slug:c.slug},update:{name:c.name},create:c});
 const catMap=Object.fromEntries((await prisma.category.findMany()).map(c=>[c.slug,c.id]));
 const demo=[
  {name:"The Everyday Tee",slug:"everyday-tee",categoryId:catMap.clothing,basePrice:38,imageUrl:"/images/tee.jpg",status:"ACTIVE",currency:"USD",description:"Organic cotton · Relaxed fit",tags:["bestseller"],position:1,color:"Chalk"},
  {name:"Relaxed Linen Shirt",slug:"relaxed-linen-shirt",categoryId:catMap.clothing,basePrice:78,imageUrl:"/images/linen-shirt.jpg",status:"ACTIVE",currency:"USD",description:"European linen · Easy silhouette",tags:["new"],position:2,color:"Oat"},
  {name:"The Daily Trouser",slug:"the-daily-trouser",categoryId:catMap.clothing,basePrice:96,imageUrl:"/images/trouser.jpg",status:"ACTIVE",currency:"USD",description:"Soft structure · Straight leg",tags:[],position:3,color:"Stone"},
  {name:"Studio Overshirt",slug:"studio-overshirt",categoryId:catMap.clothing,basePrice:128,imageUrl:"/images/overshirt.jpg",status:"ACTIVE",currency:"USD",description:"Midweight cotton · Layering piece",tags:["limited"],position:4,color:"Moss"},
  {name:"Sculpted Knit",slug:"sculpted-knit",categoryId:catMap.clothing,basePrice:84,imageUrl:"/images/knit.jpg",status:"ACTIVE",currency:"USD",description:"Soft-touch yarn · Modern fit",tags:[],position:5,color:"Espresso"},
  {name:"Weekend Jacket",slug:"weekend-jacket",categoryId:catMap.clothing,basePrice:168,imageUrl:"/images/jacket.jpg",status:"ACTIVE",currency:"USD",description:"Lightweight layer · Utility details",tags:["new"],position:6,color:"Sand"},
  {name:"Everyday Leather Sneaker",slug:"everyday-leather-sneaker",categoryId:catMap.shoes,basePrice:112,imageUrl:"/images/sneaker.jpg",status:"ACTIVE",currency:"USD",description:"Clean profile · Cushioned sole",tags:["bestseller"],position:7,color:"White"},
  {name:"Weekend Runner",slug:"weekend-runner",categoryId:catMap.shoes,basePrice:138,imageUrl:"/images/runner.jpg",status:"ACTIVE",currency:"USD",description:"Lightweight comfort · Everyday wear",tags:["new"],position:8,color:"Stone"},
  {name:"The Carryall",slug:"the-carryall",categoryId:catMap.bags,basePrice:145,imageUrl:"/images/carryall.jpg",status:"ACTIVE",currency:"USD",description:"Room for the essentials · Soft structure",tags:[],position:9,color:"Cognac"},
  {name:"Mini Crossbody",slug:"mini-crossbody",categoryId:catMap.bags,basePrice:89,imageUrl:"/images/crossbody.jpg",status:"ACTIVE",currency:"USD",description:"Hands-free carry · Adjustable strap",tags:["new"],position:10,color:"Black"},
  {name:"Everyday Cap",slug:"everyday-cap",categoryId:catMap.accessories,basePrice:32,imageUrl:"/images/cap.jpg",status:"ACTIVE",currency:"USD",description:"Cotton twill · Adjustable fit",tags:[],position:11,color:"Olive"},
  {name:"Minimalist Sunglasses",slug:"minimalist-sunglasses",categoryId:catMap.accessories,basePrice:58,imageUrl:"/images/sunglasses.jpg",status:"ACTIVE",currency:"USD",description:"UV protection · Classic frame",tags:[],position:12,color:"Tortoise"}
 ];
 for(const p of demo){
  const{color,...data}=p;
  const product=await prisma.product.upsert({where:{slug:p.slug},update:data,create:data});
  const sku=p.slug.toUpperCase()+"-ONE";
  const variant=await prisma.productVariant.upsert({where:{sku},update:{productId:product.id,color},create:{productId:product.id,sku,size:"ONE SIZE",color}});
  await prisma.inventory.upsert({where:{variantId:variant.id},update:{onHand:20},create:{variantId:variant.id,locationCode:"DEMO-01",fulfillmentType:"OWN_WAREHOUSE",onHand:20,reorderPoint:3}});
 }
 /* The home page is a single row. It is only created here, never overwritten,
    so edits made in the admin console survive a re-seed. */
 await prisma.homepage.upsert({where:{id:1},update:{},create:{id:1}});
 console.log("Seeded demo categories and products.");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
