/* =========================================================
   Tirur Connect — app.js
   A tiny "mock backend" built on localStorage so every flow
   (membership approval, ad expiry, resume gating, payments)
   actually works for demo purposes, with NO server required.
   In production this layer is swapped for real API calls.
   ========================================================= */

const DB_KEY = "tc_db_v3"; // v3 uses the business-focused directory category list
const AUTH_STORAGE_KEY = "tc_auth_v1";
const API_BASE_URL = window.TC_API_BASE_URL || "http://localhost:5001/api";

const AD_BADGES = ["LIVE", "PROMO", "OFFER", "NEWS", "NOTICE"];
const AD_CATEGORIES = ["Education", "Electronics Offers", "Food & Coffee Offers", "Fashion", "Finance", "Jobs", "Business", "Travel", "Aviation", "Chamber News", "Local News", "Offers", "Other"];
const LEGACY_SPOTLIGHT_ADS = [];

/* ---------------- Seed data ---------------- */
function seedDB(){
  return {
    users: [],
    session: null, // holds logged-in user id

    notices: [
      "⛅ ഇന്നത്തെ കാലാവസ്ഥ: 31°C, ഭാഗികമായ മേഘാവൃതം — ആർദ്രത 78%",
      "🚧 തിരൂർ ജംഗ്ഷൻ സമീപം റോഡ് നിർമ്മാണ പ്രവർത്തനം — വൈകീട്ട് 6 PM വരെ ട്രാഫിക് നിയന്ത്രണം",
      "🩸 ടൗൺ ഹാളിൽ ഞായറാഴ്ച രക്തദാന ക്യാമ്പ് — രാവിലെ 10 AM",
      "🎉 തിരൂർ ചേംബർ ഓഫ് കൊമേഴ്‌സ് വാർഷിക യോഗം — സെപ്റ്റംബർ 20",
      "💡 നാളെ വാർഡ് 4-ൽ 10 AM – 1 PM പവർ മെയിൻ്റനൻസ്"
    ],

    // Business-focused categories used throughout the public directory and forms.
    categories: [
      { id:"textiles",            label:"Textiles",                sub:"", icon:"👕" },
      { id:"gold_silver",         label:"Gold & Silver",           sub:"", icon:"💍" },
      { id:"groceries",           label:"Groceries",               sub:"", icon:"🛒" },
      { id:"stationery",          label:"Stationery",              sub:"", icon:"✏️" },
      { id:"footwear",            label:"Footwear",                sub:"", icon:"👟" },
      { id:"fruits_veg",          label:"Fruits & Veg",            sub:"", icon:"🥬" },
      { id:"distributor",         label:"Distributor",             sub:"", icon:"🚚" },
      { id:"automobile",          label:"Automobile",              sub:"", icon:"🚗" },
      { id:"hotels",              label:"Hotels",                  sub:"", icon:"🏨" },
      { id:"mobile_accessories",  label:"Mobile Accessories",      sub:"", icon:"📱" },
      { id:"electronics_home",    label:"Electronics & Home",      sub:"", icon:"📺" },
      { id:"opticals",            label:"Opticals",                sub:"", icon:"👓" },
      { id:"hardware",            label:"Hardware",                sub:"", icon:"🛠️" },
      { id:"bakery",              label:"Bakery",                  sub:"", icon:"🥐" },
      { id:"chocolate_nuts",      label:"Chocolate & Nuts",        sub:"", icon:"🍫" },
      { id:"other",               label:"Other",                   sub:"", icon:"🧩" }
    ],

    businesses: [],

    // FREE "List Your Business/Service/Number" submissions — separate from paid Chamber Membership.
    // Anyone can submit; an Admin must review & approve before it appears in the public directory.
    listingSubmissions: [],

    jobs: [],

    // PAID Chamber of Commerce Membership applications — completely separate from free listings above
    members: [],

    ads: []
  };
}

function getDB(){
  let raw = localStorage.getItem(DB_KEY);
  if(!raw){
    const seeded = seedDB();
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }
  const db = JSON.parse(raw);
  if(Array.isArray(db.users) && db.users.length){ db.users = []; saveDB(db); }
  if(Array.isArray(db.businesses) && db.businesses.length){ db.businesses = []; saveDB(db); }
  if(Array.isArray(db.listingSubmissions) && db.listingSubmissions.length){ db.listingSubmissions = []; saveDB(db); }
  if(Array.isArray(db.members) && db.members.length){ db.members = []; saveDB(db); }
  if(Array.isArray(db.jobs) && db.jobs.length){ db.jobs = []; saveDB(db); }
  migrateAds(db);
  return db;
}
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function resetDB(){ localStorage.removeItem(DB_KEY); location.reload(); }

function migrateAds(db){
  if(!Array.isArray(db.ads)) db.ads = [];
  return db;
}

function isAdLive(ad, now = new Date()){
  if(!ad || ad.enabled === false || ad.status !== "published") return false;
  const start = ad.startAt ? new Date(ad.startAt) : new Date(`${ad.start}T00:00`);
  const end = ad.endAt ? new Date(ad.endAt) : new Date(`${ad.end}T23:59:59`);
  return !Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && now >= start && now <= end;
}

function getLiveAds(placement){
  const db = migrateAds(getDB());
  return db.ads.filter(ad => (!placement || ad.placement === placement) && isAdLive(ad)).sort((a,b)=>(a.order||0)-(b.order||0));
}

async function renderLiveAds(targetId){
  const target = document.getElementById(targetId);
  if(!target) return;
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let ads = [];
  try {
    const response = await fetch(`${API_BASE_URL}/public/ads`);
    const result = await response.json().catch(() => ({}));
    ads = result.data?.length ? result.data : getLiveAds();
  } catch (error) {
    ads = getLiveAds();
  }
  target.innerHTML = ads.length ? ads.map(ad => `
    <a class="feed-ad-item" href="${escapeHtml(ad.link || '#')}">
      <div class="feed-ad-thumb-wrap" style="background-image:${ad.imageUrl ? `url('${escapeHtml(ad.imageUrl)}')` : 'none'};">
        ${ad.imageUrl ? `<img src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.title)}" class="feed-ad-thumb">` : '<span class="feed-ad-fallback">📢</span>'}
        <span class="feed-badge-mini">${escapeHtml(ad.badge || 'AD')}</span>
      </div>
      <div class="feed-ad-body">
        <h4 class="feed-ad-title">${escapeHtml(ad.title)}</h4>
        <p class="feed-ad-subtitle">${escapeHtml(ad.description || ad.subtitle || ad.content || 'Featured on Tirur Connect')}</p>
        <div class="feed-ad-meta"><span class="feed-ad-tag tag-company">${escapeHtml(ad.category || 'AD')}</span></div>
      </div>
    </a>`).join('') : '<div class="empty-state">No active advertisements.</div>';
}

async function renderResumeDirectory(targetId){
  const target = document.getElementById(targetId);
  if(!target) return;
  try{
    const response = await apiRequest('/resumes');
    const resumes = response.data || [];
    window.tcResumeDirectory = resumes;
    const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    target.innerHTML = resumes.length ? resumes.map(resume => `<article class="card mt-12" style="padding:16px 18px;border:1px solid #e4ebe8;box-shadow:0 4px 14px rgba(14,71,55,.06);"><div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;"><div style="display:flex;align-items:center;gap:11px;"><div style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--brand),var(--brand-dark));color:#fff;font-weight:800;font-size:15px;">${escapeHtml(String(resume.name || 'C').trim().charAt(0).toUpperCase())}</div><div><strong style="display:block;font-size:14.5px;color:var(--text);">${escapeHtml(resume.name)}</strong><span class="text-soft" style="font-size:11px;">Active Job Seeker · CV available</span></div></div><span class="status active" style="font-size:10px;">ACTIVE</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;"><button class="btn btn-outline btn-sm" onclick="viewSharedResumeDetails('${resume.id}')">View Details</button><button class="btn btn-primary btn-sm" onclick="viewSharedResume('${resume.id}')">View CV</button></div></article>`).join('') : '<p class="text-soft">No uploaded CVs yet.</p>';
  }catch(error){ target.innerHTML = `<p class="text-soft">${error.message || 'Unable to load uploaded CVs.'}</p>`; }
}

function viewSharedResumeDetails(id){
  const resume = (window.tcResumeDirectory || []).find(item => String(item.id) === String(id));
  const modal = document.getElementById('careerModalBg');
  const box = document.getElementById('careerModalBox');
  if(!resume || !modal || !box) return;
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  box.innerHTML = `<div class="modal-close" onclick="closeCareerModal()">×</div><h2 style="font-size:18px;">${escapeHtml(resume.name)}</h2><p class="text-soft">${escapeHtml(resume.email)} · ${escapeHtml(resume.location || 'Location not provided')}</p><div class="card mt-12"><p><strong>Phone:</strong> ${escapeHtml(resume.phone || 'Not provided')}</p><p><strong>Education:</strong> ${escapeHtml(resume.education || 'Not provided')}</p><p><strong>Experience:</strong> ${escapeHtml(resume.experience || 'Not provided')}</p><p><strong>Skills:</strong> ${escapeHtml((resume.skills || []).join(', ') || 'Not provided')}</p><p><strong>CV:</strong> ${escapeHtml(resume.cv?.fileName || 'Uploaded CV')}</p></div><button class="btn btn-primary mt-12" onclick="viewSharedResume('${escapeHtml(resume.id)}')">View CV</button>`;
  modal.classList.add('open');
}

function closeCareerModal(){
  const modal = document.getElementById('careerModalBg');
  if(modal) modal.classList.remove('open');
}

async function viewSharedResume(id){
  const preview = window.open('', '_blank');
  if(!preview){ toast('Please allow pop-ups to view the CV.'); return; }
  preview.document.write('<p style="font-family:Arial,sans-serif;padding:24px;">Loading CV...</p>');
  try{
    const result = await apiRequest(`/resumes/${id}/cv`);
    const cv = result.cv;
    const binary = atob(String(cv.file || '').replace(/^data:[^,]+,/, ''));
    const bytes = new Uint8Array(binary.length);
    for(let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: cv.fileType || 'application/octet-stream' }));
    preview.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }catch(error){ preview.close(); toast(error.message || 'Unable to load CV.'); }
}

async function apiRequest(path, options = {}){
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const token = getAuthToken();
  if(token) headers.Authorization = `Bearer ${token}`;
  let response;
  try{
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  }catch(error){
    const networkError = new Error('Unable to connect to the server.');
    networkError.isNetworkError = true;
    throw networkError;
  }
  const data = await response.json().catch(()=>({}));
  if(!response.ok){
    const apiError = new Error(data.message || 'Request failed.');
    apiError.status = response.status;
    throw apiError;
  }
  return data;
}

/* ---------------- Auth helpers ---------------- */
function getSession(){
  const auth = getStoredAuth();
  return auth ? auth.user : null;
}
function getAuthToken(){
  const auth = getStoredAuth();
  return auth ? auth.token : null;
}
function logout(){
  clearAuthSession();
  window.location.href = "login.html";
}
function clearAuthSession(){
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
function getStoredAuth(){
  try{
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if(!raw) return null;
    const auth = JSON.parse(raw);
    return auth && auth.token && auth.user ? auth : null;
  }catch(error){
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}
function saveAuthSession(token, user){
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
}
function isChamberMember(){
  const u = getSession();
  return !!u && u.role === "chamber_member" && u.status === "active";
}
function isAdmin(){ const u = getSession(); return u && u.role === "admin"; }

/* ---------------- Chamber QR verification ---------------- */
function isActiveMembership(member){ return !!member && member.status === "active"; }
function canAccessMemberQr(){
  // QR profiles are public verification pages. They never authenticate a user
  // or reveal private/member-only account data.
  return true;
}
function canManageMemberQr(member){
  const u = getSession();
  return !!u && (u.role === "admin" || (u.role === "chamber_member" && u.memberId === member.id));
}
function memberProfileUrl(memberId){
  return new URL(`member-profile.html?id=${encodeURIComponent(memberId)}`, window.location.href).href;
}
function memberQrImageUrl(memberId){
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(memberProfileUrl(memberId))}`;
}

/* ---------------- Career helpers ---------------- */
function canManageJobs(){
  const u = getSession();
  return !!u && ["shop_owner", "chamber_member", "admin"].includes(u.role);
}
function canViewApplicants(job){
  const u = getSession();
  if(!u) return false;
  if(u.role === "admin" || isChamberMember()) return true;
  return u.role === "shop_owner" && (!job || job.ownerId === u.id || job.company === u.name);
}
function getResume(user){ return user && user.resume ? user.resume : null; }
function saveResume(userId, resume){
  const db = getDB(); const user = db.users.find(u=>u.id===userId);
  if(!user) return;
  user.resume = { ...resume, updatedOn:new Date().toISOString().slice(0,10) };
  saveDB(db);
}

/* ---------------- Ad auto-expiry (simulates a cron/reminder job) ---------------- */
function refreshAdStatuses(){
  return migrateAds(getDB());
}

/* ---------------- Membership expiry reminder simulation ---------------- */
function membershipDaysLeft(m){
  if(!m.expiresOn) return null;
  const diff = (new Date(m.expiresOn) - new Date());
  return Math.ceil(diff / (1000*60*60*24));
}

/* ---------------- Toast ---------------- */
function toast(msg){
  let el = document.getElementById("toast");
  if(!el){
    el = document.createElement("div");
    el.id = "toast"; el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.classList.remove("show"), 2600);
}

/* ---------------- Header / Nav injection ---------------- */
function renderChrome(activePage){
  const session = getSession();
  const roleLabel = session ? ({
    public:"Public", job_seeker:"Job Seeker", shop_owner:"Shop Owner", chamber_member:"Chamber Member", admin:"Admin"
  })[session.role] : null;

  // Topbar
  document.querySelectorAll("[data-chrome=topbar]").forEach(el=>{
    el.innerHTML = `
      <div class="container">
        <div class="emergency"><span>🚨 <b>Police:</b> 100</span><span class="hide-mobile">🚑 <b>Ambulance:</b> 108</span><span class="hide-mobile">🔥 <b>Fire:</b> 101</span></div>
        <div class="weather">📍 Tirur, Kerala · 31°C</div>
      </div>`;
  });

  // Header
  document.querySelectorAll("[data-chrome=header]").forEach(el=>{
    el.innerHTML = `
      <div class="container">
        <a href="index.html" class="brand">
          <img src="assets/tirur-connect-icon.svg" alt="" class="brand-logo" width="36" height="36">
          <span class="brand-text">Tirur Connect
            <small>Community · Directory · Chamber</small>
          </span>
        </a>
        <nav class="nav-desktop">
          <ul>
            <li><a href="index.html" class="${activePage==='home'?'active':''}">Home</a></li>
            <li><a href="about.html" class="${activePage==='about'?'active':''}">About</a></li>
            <li><a href="directory.html" class="${activePage==='directory'?'active':''}">Directory</a></li>
            <li><a href="jobs.html" class="${activePage==='jobs'?'active':''}">Careers</a></li>
            <li><a href="list-business.html" class="${activePage==='listbiz'?'active':''}">List Your Business <span style="font-size:10px;color:var(--accent-dark);font-weight:800;">FREE</span></a></li>
            <li><a href="membership.html" class="${activePage==='membership'?'active':''}">Chamber Membership</a></li>
            ${session && session.role === 'admin' ? `<li><a href="admin.html" class="${activePage==='admin'?'active':''}">Admin</a></li>` : ''}
            ${session && session.role === 'job_seeker' ? `<li><a href="job-seeker.html" class="${activePage==='job-seeker'?'active':''}">My Profile</a></li>` : ''}
            ${session && session.role === 'shop_owner' ? `<li><a href="shop-owner.html" class="${activePage==='shop-owner'?'active':''}">My Shop</a></li>` : ''}
            ${session && session.role === 'chamber_member' ? `<li><a href="chamber-member.html" class="${activePage==='chamber-member'?'active':''}">My Dashboard</a></li>` : ''}
          </ul>
        </nav>
        <div class="header-actions">
          ${session ? `
            <a href="${
              session.role === 'admin' ? 'admin.html' :
              session.role === 'job_seeker' ? 'job-seeker.html' :
              session.role === 'shop_owner' ? 'shop-owner.html' :
              session.role === 'chamber_member' ? 'chamber-member.html' : '#'
            }" class="role-pill hide-mobile" style="text-decoration:none;" title="Go to my dashboard">
              <span class="avatar">${session.name.charAt(0)}</span>
              ${session.name} · ${roleLabel}
            </a>
            <button class="btn btn-outline btn-sm" onclick="logout()">Logout</button>
          ` : `
            <a href="login.html" class="btn btn-primary btn-sm">Login</a>
          `}
          <button class="hamburger" id="hamburgerBtn"><span></span><span></span><span></span></button>
        </div>
      </div>`;
  });

  // Mobile menu
  document.querySelectorAll("[data-chrome=mobilemenu]").forEach(el=>{
    el.innerHTML = `
      <div class="panel">
        <div class="close-x" id="closeMenuBtn">✕</div>
        ${session ? `<div class="role-pill" style="margin-bottom:14px;"><span class="avatar">${session.name.charAt(0)}</span> ${session.name} · ${roleLabel}</div>` : ""}
        <a href="index.html" class="${activePage==='home'?'active':''}">🏠 Home</a>
        <a href="about.html" class="${activePage==='about'?'active':''}">ℹ️ About Us</a>
        <a href="directory.html" class="${activePage==='directory'?'active':''}">🏪 Business Directory</a>
        <a href="jobs.html" class="${activePage==='jobs'?'active':''}">💼 Careers</a>
        <a href="list-business.html" class="${activePage==='listbiz'?'active':''}">📋 List Your Business (Free)</a>
        <a href="membership.html" class="${activePage==='membership'?'active':''}">🎖️ Chamber Membership (Paid)</a>
        ${session && session.role==='admin' ? `<a href="admin.html" class="${activePage==='admin'?'active':''}">🛠️ Admin Dashboard</a>` : ''}
        ${session && session.role==='job_seeker' ? `<a href="job-seeker.html" class="${activePage==='job-seeker'?'active':''}">💼 My Profile</a>` : ''}
        ${session && session.role==='shop_owner' ? `<a href="shop-owner.html" class="${activePage==='shop-owner'?'active':''}">🏪 My Shop</a>` : ''}
        ${session && session.role==='chamber_member' ? `<a href="chamber-member.html" class="${activePage==='chamber-member'?'active':''}">🏅 My Dashboard</a>` : ''}
        ${session ? `<a href="#" onclick="logout()">🚪 Logout</a>` : `<a href="login.html">🔐 Login / Register</a>`}
      </div>`;
    el.addEventListener("click", (e)=>{ if(e.target === el) el.classList.remove("open"); });
  });

  const hb = document.getElementById("hamburgerBtn");
  const mm = document.querySelector("[data-chrome=mobilemenu]");
  if(hb && mm) hb.addEventListener("click", ()=> mm.classList.add("open"));
  const cx = document.getElementById("closeMenuBtn");
  if(cx && mm) cx.addEventListener("click", ()=> mm.classList.remove("open"));

  // Bottom tab bar (mobile)
  document.querySelectorAll("[data-chrome=tabbar]").forEach(el=>{
    el.innerHTML = `
      <a href="index.html" class="${activePage==='home'?'active':''}"><span class="ic">🏠</span>Home</a>
      <a href="directory.html" class="${activePage==='directory'?'active':''}"><span class="ic">🏪</span>Directory</a>
      <a href="jobs.html" class="${activePage==='jobs'?'active':''}"><span class="ic">💼</span>Careers</a>
      <a href="membership.html" class="${activePage==='membership'?'active':''}"><span class="ic">🎖️</span>Chamber</a>
      <a href="${session ? (session.role === 'admin' ? 'admin.html' : session.role === 'job_seeker' ? 'job-seeker.html' : session.role === 'shop_owner' ? 'shop-owner.html' : session.role === 'chamber_member' ? 'shop-owner.html' : 'login.html') : 'login.html'}" class="${activePage==='admin'||activePage==='login'||activePage==='job-seeker'||activePage==='shop-owner'?'active':''}"><span class="ic">${session ? (session.role==='admin' ? '🛠️' : session.role === 'job_seeker' ? '💼' : session.role === 'shop_owner' ? '🏪' : session.role === 'chamber_member' ? '🏪' : '👤') : '🔐'}</span>${session ? (session.role==='admin' ? 'Admin' : session.role === 'job_seeker' ? 'My Profile' : session.role === 'shop_owner' ? 'My Shop' : session.role === 'chamber_member' ? 'My Shop' : 'Account') : 'Login'}</a>
    `;
  });

  // Footer
  document.querySelectorAll("[data-chrome=footer]").forEach(el=>{
    el.innerHTML = `
      <div class="container">
        <div class="cols">
          <div>
            <h4 class="footer-brand"><img src="assets/tirur-connect-icon.svg" alt="" class="footer-logo" width="28" height="28"> Tirur Connect</h4>
            <p style="opacity:.85">A hyperlocal community &amp; business portal powered by the Tirur Chamber of Commerce. Discover local shops, find jobs, and grow your business.</p>
          </div>
          <div><h4>Explore</h4>
            <p><a href="about.html">About Us</a></p>
            <p><a href="directory.html">Business Directory</a></p>
            <p><a href="jobs.html">Career Portal</a></p>
            <p><a href="list-business.html">List Your Business (Free)</a></p>
            <p><a href="membership.html">Chamber Membership (Paid)</a></p>
          </div>
          <div><h4>Contact</h4>
            <p>Tirur Chamber of Commerce</p>
            <p>Main Road, Tirur, Kerala</p>
            <p>+91 98765 00000</p>
          </div>
           </div>
        <div class="bottom">© 2026 Tirur Connect · osforh</div>
      </div>`;
  });
}

document.addEventListener("DOMContentLoaded", ()=>{ refreshAdStatuses(); });
