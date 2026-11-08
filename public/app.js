/* FORME storefront.
 *
 * The catalogue is loaded from the API - the admin console is the single
 * source of truth. Add or edit a product there and it shows up here.
 */
const API=window.location.origin;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rates={USD:1,EUR:.92,GBP:.79,CAD:1.36,AUD:1.52},symbols={USD:"$",EUR:"€",GBP:"£",CAD:"CA$",AUD:"A$"};
let products=[],categories=[],activeFilter="All",currency="USD";
let cart=readList("formeCart"),wishlist=readList("formeWishlist");
function readList(key){try{const v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
const money=n=>symbols[currency]+(n*rates[currency]).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- catalogue ---------------------------------------------------- */
function toProduct(p){
 const variant=(p.variants||[])[0]||{};
 return {slug:p.slug,name:p.name,category:p.category?.name||"",price:Number(p.basePrice)||0,
  color:variant.color||"",tag:p.tags&&p.tags[0]?String(p.tags[0]).toUpperCase():"",
  img:p.imageUrl||"/images/placeholder.jpg",desc:p.description||"",variantId:variant.id||""};
}
async function loadCatalogue(){
 const grid=$("#products");
 grid.innerHTML='<p class="empty">Loading the collection…</p>';
 try{
  const res=await fetch(`${API}/api/store/products?limit=100`,{headers:{Accept:"application/json"}});
  if(!res.ok)throw new Error(`API responded ${res.status}`);
  const data=await res.json();
  products=(data.items||[]).map(toProduct);
  categories=await loadCategories();
  buildCategoryLinks();
  // drop cart and wishlist entries that are no longer in the catalogue
  cart=cart.filter(x=>x&&typeof x.slug==="string"&&products.some(p=>p.slug===x.slug));
  wishlist=wishlist.filter(x=>typeof x==="string"&&products.some(p=>p.slug===x));
  persist();
  renderProducts();renderCart();
 }catch(err){
  console.error("catalogue could not be loaded",err);
  grid.innerHTML='<p class="empty">The catalogue could not be loaded. Make sure the API is running on this port.</p>';
  $("#resultCount").textContent="0 pieces";
 }
}
async function loadCategories(){
 try{const r=await fetch(`${API}/api/store/categories`);return r.ok?await r.json():[]}catch{return[]}
}
function buildCategoryLinks(){
 const names=["All",...categoryOrder()];
 if(!names.includes(activeFilter))activeFilter="All";
 $("#filters").innerHTML=names.map(n=>`<button class="filter${n===activeFilter?" active":""}" data-filter="${esc(n)}">${n==="All"?"All pieces":esc(n)}</button>`).join("");
 const nav=names.map(n=>`<a href="#shop" data-category="${esc(n)}">${n==="All"?"Shop all":esc(n)}</a>`).join("");
 $("#mainNav").innerHTML=nav+'<a href="#story">Our story</a>';
 $("#mobileNav").innerHTML=names.map(n=>`<a href="#shop" data-category="${esc(n)}">${n==="All"?"Shop all":esc(n)}</a>`).join("");
 // re-apply the UI translations now that the category links have been rebuilt
 if(typeof formeSetLocale==="function")formeSetLocale(localStorage.getItem("formeLocale")||"en");
}
/* Categories follow the curated product order, so the nav reads
   Clothing, Shoes, Bags, Accessories rather than alphabetically.
   Categories without products are appended at the end. */
function categoryOrder(){
 const fromProducts=[];
 for(const p of products)if(p.category&&!fromProducts.includes(p.category))fromProducts.push(p.category);
 const rest=categories.map(c=>c.name).filter(n=>n&&!fromProducts.includes(n));
 return [...fromProducts,...rest];
}

/* ---------- homepage content -------------------------------------------- */
/* The hero and the "our story" block are edited in the admin console
   (Admin -> Homepage). The markup in index.html stays as the fallback, so
   the page still renders when the API cannot be reached. */
async function loadHomepage(){
 try{
  const res=await fetch(`${API}/api/store/homepage`,{headers:{Accept:"application/json"}});
  if(!res.ok)throw new Error(`API responded ${res.status}`);
  applyHomepage(await res.json());
 }catch(err){console.warn("homepage content could not be loaded",err)}
}
function applyHomepage(h){
 if(!h)return;
 const heroImg=$("#heroImage"),storyImg=$("#storyImage");
 if(heroImg&&h.heroImageUrl)heroImg.src=h.heroImageUrl;
 if(storyImg&&h.storyImageUrl)storyImg.src=h.storyImageUrl;
 const setText=(sel,value)=>{const el=$(sel);if(el&&value)el.textContent=value};
 setText("#heroEyebrow",h.heroEyebrow);setText("#heroBody",h.heroBody);
 setText("#storyEyebrow",h.storyEyebrow);setText("#storyBody",h.storyBody);
 const setLines=(sel,first,second,secondTag)=>{
  const el=$(sel);if(!el)return;const parts=[];
  if(first)parts.push(esc(first));
  if(second)parts.push(`<${secondTag}>${esc(second)}</${secondTag}>`);
  if(parts.length)el.innerHTML=parts.join("<br>");
 };
 setLines("#heroTitle",h.heroTitle1,h.heroTitle2,"em");
 setLines("#storyTitle",h.storyTitle1,h.storyTitle2,"em");
 setLines("#heroLabel",h.heroLabel1,h.heroLabel2,"b");
}

/* ---------- rendering ---------------------------------------------------- */
function renderProducts(){
 const q=$("#searchInput").value.trim().toLowerCase();
 let list=products.filter(p=>(activeFilter==="All"||p.category===activeFilter)&&(!q||(p.name+" "+p.category+" "+p.desc+" "+p.color).toLowerCase().includes(q)));
 const sort=$("#sortSelect").value;
 if(sort==="price-low")list.sort((a,b)=>a.price-b.price);
 if(sort==="price-high")list.sort((a,b)=>b.price-a.price);
 if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name));
 $("#resultCount").textContent=`${list.length} ${list.length===1?"piece":"pieces"}`;
 $("#products").innerHTML=list.map(p=>`<article class="product-card"><div class="product-image"><img loading="lazy" src="${esc(p.img)}" alt="${esc(p.name)}"><button class="wishlist" aria-label="Toggle wishlist" data-wish="${esc(p.slug)}">${wishlist.includes(p.slug)?"♥":"♡"}</button>${p.tag?`<span class="tag">${esc(p.tag)}</span>`:""}<button class="quick-add" data-add="${esc(p.slug)}">Quick add +</button></div><div class="product-info"><div>${esc(p.name)}<div class="product-meta">${p.color?esc(p.color)+" · ":""}${esc(p.category)}</div><div class="swatches"><i class="swatch" style="background:#d9d4c8"></i><i class="swatch" style="background:#484940"></i><i class="swatch" style="background:#b6b9a8"></i></div></div><span>${money(p.price)}</span></div></article>`).join("")||'<p class="empty">No pieces found. Try another search.</p>';
}
function renderCart(){
 const count=cart.reduce((n,x)=>n+x.qty,0),total=cart.reduce((n,x)=>{const p=products.find(p=>p.slug===x.slug);return n+(p?x.qty*p.price:0)},0);
 $("#cartCount").textContent=count;$("#subtotal").textContent=money(total);
 $("#cartItems").innerHTML=cart.length?cart.map(x=>{const p=products.find(p=>p.slug===x.slug);if(!p)return"";return `<div class="cart-line"><img src="${esc(p.img)}" alt=""><div><b>${esc(p.name)}</b><p>${p.color?esc(p.color)+" · ":""}${money(p.price)}</p><div class="qty"><button data-slug="${esc(p.slug)}" data-qty="-1" aria-label="Decrease quantity">−</button><span>${x.qty}</span><button data-slug="${esc(p.slug)}" data-qty="1" aria-label="Increase quantity">+</button></div></div><b>${money(p.price*x.qty)}</b></div>`}).join(""):'<div class="empty">Your bag is waiting for something good.</div>';
}

/* ---------- cart and wishlist -------------------------------------------- */
function persist(){localStorage.setItem("formeCart",JSON.stringify(cart));localStorage.setItem("formeWishlist",JSON.stringify(wishlist))}
function addToCart(slug){const found=cart.find(x=>x.slug===slug);found?found.qty++:cart.push({slug,qty:1});persist();renderCart();toast("Added to your bag")}
function changeQty(slug,d){const x=cart.find(x=>x.slug===slug);if(x)x.qty+=d;cart=cart.filter(x=>x.qty>0);persist();renderCart()}
function toggleWishlist(slug){wishlist.includes(slug)?wishlist=wishlist.filter(x=>x!==slug):wishlist.push(slug);persist();renderProducts();toast(wishlist.includes(slug)?"Saved to wishlist":"Removed from wishlist")}
function setFilter(name){activeFilter=name;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x.dataset.filter===activeFilter));renderProducts()}

/* ---------- overlays ------------------------------------------------------ */
function openCart(){$("#cartPanel").classList.add("open");$("#overlay").classList.add("open")}
function closeCart(){$("#cartPanel").classList.remove("open");$("#overlay").classList.remove("open")}
function openModal(html){$("#modalContent").innerHTML=html;$("#modalBackdrop").classList.add("open")}
function closeModal(){$("#modalBackdrop").classList.remove("open")}
let toastTimer;function toast(msg){$("#toast").textContent=msg;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),1900)}
function checkout(){if(!cart.length){toast("Your bag is empty");return}const total=cart.reduce((n,x)=>{const p=products.find(p=>p.slug===x.slug);return n+(p?x.qty*p.price:0)},0);closeCart();openModal(`<p class="eyebrow">DEMO CHECKOUT</p><h2>Almost yours.</h2><p>This prototype can demonstrate the checkout flow, but payment, tax and shipping services are not connected. No payment will be taken.</p><form id="checkoutForm"><label>Email address</label><input type="email" required placeholder="you@example.com"><label>Shipping country</label><select required><option value="">Choose country</option><option>United States</option><option>Canada</option><option>United Kingdom</option><option>Germany</option><option>France</option><option>Australia</option><option>Other</option></select><label>Postal code</label><input required placeholder="Postal / ZIP code"><div class="subtotal"><span>Demo subtotal</span><b>${money(total)}</b></div><button class="button dark" type="submit">Place demo order ↗</button></form>`);$("#checkoutForm").onsubmit=e=>{e.preventDefault();cart=[];persist();renderCart();openModal(`<div class="order-success"><p class="eyebrow">ORDER DEMONSTRATION</p><h2>Thank you.</h2><p>Your demo checkout was completed. This did not charge you and no real order was created.</p><button class="button dark" id="doneBtn">Back to the store ↗</button></div>`);$("#doneBtn").onclick=closeModal}}

/* ---------- events -------------------------------------------------------- */
document.addEventListener("click",e=>{
 const add=e.target.closest("[data-add]");if(add){addToCart(add.dataset.add);return}
 const wish=e.target.closest("[data-wish]");if(wish){toggleWishlist(wish.dataset.wish);return}
 const qty=e.target.closest("[data-qty]");if(qty){changeQty(qty.dataset.slug,Number(qty.dataset.qty));return}
 const filter=e.target.closest("[data-filter]");if(filter){setFilter(filter.dataset.filter);return}
 const nav=e.target.closest("[data-category]");if(nav){setFilter(nav.dataset.category);$("#mobileNav").classList.remove("show")}
});
$("#searchInput").addEventListener("input",renderProducts);$("#sortSelect").addEventListener("change",renderProducts);$("#currency").addEventListener("change",e=>{currency=e.target.value;renderProducts();renderCart()});$("#searchToggle").onclick=()=>{$("#searchInput").focus();$("#shop").scrollIntoView()};$("#cartBtn").onclick=openCart;$("#closeCart").onclick=closeCart;$("#overlay").onclick=closeCart;$("#checkoutBtn").onclick=checkout;$("#closeModal").onclick=closeModal;$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});$("#accountBtn").onclick=()=>openModal('<p class="eyebrow">YOUR FORME</p><h2>Welcome back.</h2><p>Customer accounts are a planned production feature. This demo does not create accounts or store personal information.</p><button class="button dark" id="accountOk">Continue browsing ↗</button>');$("#modalContent").addEventListener("click",e=>{if(e.target.id==="accountOk")closeModal()});$("#mobileMenu").onclick=()=>$("#mobileNav").classList.toggle("show");
$("#newsletterForm").onsubmit=e=>{e.preventDefault();$("#newsletterMessage").textContent="Thanks for your interest — demo signup only; no email was stored.";e.target.reset()};

/* ---------- go ------------------------------------------------------------ */
loadCatalogue();
loadHomepage();
