import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { STATIC_AVATARS } from "./avatar-assets.js";
import { CUSTOM_AVATARS } from "./custom-avatars.js";
import { MINIROOM_TEMPLATES } from "./miniroom-assets.js";
import { RESTORED_AVATAR_DATA_URIS } from "./restored-avatar-images.js";

window.__ECONOMY_BOOT_STARTED__ = true;
let firebaseReady = false;
let snackDefaultsRepairQueued = false;
let snackDefaultsRepairCompleted = false;
const SITE_CONFIG = window.ECONOMY_SITE_CONFIG || {};
function cfg(path, fallback){
  const value=String(path).split(".").reduce((acc,key)=>acc && Object.prototype.hasOwnProperty.call(acc,key) ? acc[key] : undefined,SITE_CONFIG);
  return value===undefined ? fallback : value;
}
function cfgNum(path, fallback){
  const value=Number(cfg(path, fallback));
  return Number.isFinite(value) ? value : fallback;
}
function cfgBool(path, fallback){
  const value=cfg(path, undefined);
  return typeof value==="boolean" ? value : fallback;
}
const INDUSTRY_CATALOG = {roles:{}, materials:{}, products:{}};
function applyThemeConfig(){
  const tokens=cfg("theme.tokens",{});
  if(!tokens || typeof tokens!=="object") return;
  const root=document.documentElement;
  Object.entries(tokens).forEach(([key,value])=>{
    if(value===undefined || value===null || value==="") return;
    root.style.setProperty(key.startsWith("--") ? key : `--${key}`, String(value));
  });
}
applyThemeConfig();
function showStartupError(title, message){
  const el=document.getElementById("status");
  if(el) el.innerHTML = `<b>${title}</b><div class="sub">${message}</div><p class="small">F12 → Console 빨간 오류를 보면 더 정확히 잡을 수 있습니다.</p>`;
}
window.addEventListener("error", e=>showStartupError("초기 실행 오류", e.message || "알 수 없는 오류"));
window.addEventListener("unhandledrejection", e=>showStartupError("비동기 실행 오류", e.reason?.message || String(e.reason || "알 수 없는 오류")));
setTimeout(()=>{
  if(!firebaseReady){
    showStartupError("Firebase 연결 지연", "5초 동안 Firebase 응답이 없습니다. 인터넷, Realtime Database 규칙, 또는 Firebase 설정을 확인하세요. 화면은 기본 데이터로 임시 표시합니다.");
    try{
      data = mergeDefaults(defaultData, data || {});
      render();
    }catch(e){
      showStartupError("임시 화면 렌더링 오류", e.message);
    }
  }
}, cfgNum("ux.firebaseDelayWarningMs",5000));

const firebaseConfig = {
  apiKey: "AIzaSyDtwpc4THHE_t3fSfV-FgS4KHF2krUosvA",
  authDomain: "economy-44982.firebaseapp.com",
  databaseURL: "https://economy-44982-default-rtdb.firebaseio.com",
  projectId: "economy-44982",
  storageBucket: "economy-44982.firebasestorage.app",
  messagingSenderId: "979007941269",
  appId: "1:979007941269:web:140c0a114b64ffecd1899c",
  measurementId: "G-ZC0FVSV9JL"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const rootRef = ref(db, "classEconomy/main");

const CENTRAL = "CENTRAL";
const TICKET_SCARCITY_WEIGHT = 0.5;
const MIN_TICKET_PRICE_MULTIPLIER = 0.7;
const MAX_TICKET_PRICE_MULTIPLIER = 2.0;
const SAVING_PAYMENT_INTERVAL_DAYS = 2;
const SNACK_PRODUCT_DEFAULTS = {
  dust:{name:"먼지",kind:"fixed",priceType:"fixed",fixedPrice:10,price:10,wholesaleRate:0.9,secret:false,note:"고정가 / 10열매"},
  peopleSnack:{name:"국민간식",kind:"economyIndex",priceType:"economyIndex",basePrice:20,baseEconomyIndex:100,sensitivity:0.5,minPrice:15,maxPrice:30,wholesaleRate:0.7,price:20,secret:false,note:"경제지수 연동 / 기본 소비재"},
  silverSpoon:{name:"은수저",kind:"economyIndex",priceType:"economyIndex",basePrice:50,baseEconomyIndex:100,sensitivity:1.1,minPrice:35,maxPrice:80,wholesaleRate:0.6,price:50,secret:false,note:"경제지수 연동 / 고급 과자"},
  artifact:{name:"고대의 유물",kind:"economyIndex",priceType:"economyIndex",basePrice:100,baseEconomyIndex:100,sensitivity:1.6,minPrice:70,maxPrice:200,wholesaleRate:0.55,price:100,secret:false,note:"경제지수 연동 / 희귀 사치재"}
};
const ticketMeta = {
  classClean: {name:"전체 청소 면제권", formula:"전날 총소득", color:"#2563eb"},
  personalClean: {name:"개인 청소 면제권", formula:"전날 총소득 ÷ 5", color:"#7c3aed"},
  playHour: {name:"1시간 놀기권", formula:"전날 총소득 × 3", color:"#db2777"},
  topDisplay: {name:"상단 표시권", formula:"고정가 5열매 · 하루 20장", color:"#f59e0b", fixedPrice:5, dailySupply:20}
};
const defaultData = {
  previousIncome: 1000,
  students: {},
  studentStatusMessages: {},
  ledger: {},
  inventories: {},
  tickets: {
    classClean:{supply:10,sold:0,stock:10},
    personalClean:{supply:10,sold:0,stock:10},
    playHour:{supply:5,sold:0,stock:5},
    topDisplay:{supply:20,sold:0,stock:20,date:today()}
  },
  ticketHoldings: {},
  deposits: {},
  savings: {},
  loans: {},
  bonds: {},
  bondIssues: {},
  fines: {},
  corporations: {},
  shareSellOrders: {},
  shareTransactions: {},
  corporateRepresentativeHistory: {},
  products: {
    dust:{id:"dust",name:"먼지",kind:"fixed",priceType:"fixed",fixedPrice:10,price:10,wholesaleRate:0.9,secret:false,note:"고정가 / 10열매"},
    peopleSnack:{id:"peopleSnack",name:"국민간식",kind:"economyIndex",priceType:"economyIndex",basePrice:20,baseEconomyIndex:100,sensitivity:0.5,minPrice:15,maxPrice:30,wholesaleRate:0.7,price:20,secret:false,note:"경제지수 연동 / 기본 소비재"},
    silverSpoon:{id:"silverSpoon",name:"은수저",kind:"economyIndex",priceType:"economyIndex",basePrice:50,baseEconomyIndex:100,sensitivity:1.1,minPrice:35,maxPrice:80,wholesaleRate:0.6,price:50,secret:false,note:"경제지수 연동 / 고급 과자"},
    artifact:{id:"artifact",name:"고대의 유물",kind:"economyIndex",priceType:"economyIndex",basePrice:100,baseEconomyIndex:100,sensitivity:1.6,minPrice:70,maxPrice:200,wholesaleRate:0.55,price:100,secret:false,note:"경제지수 연동 / 희귀 사치재"}
  },
  jobs: {"banker": {"id": "banker", "name": "은행장", "wage": 100, "payType": "일당", "slots": 1, "note": ""}, "siri": {"id": "siri", "name": "시리", "wage": 10, "payType": "일당", "slots": 1, "note": ""}, "bixby": {"id": "bixby", "name": "빅스비", "wage": 10, "payType": "일당", "slots": 1, "note": ""}, "cleaner": {"id": "cleaner", "name": "청소부", "wage": 10, "payType": "일당", "slots": 1, "note": ""}, "artist": {"id": "artist", "name": "화가", "wage": 20, "payType": "건당", "slots": 2, "note": ""}, "item_manager": {"id": "item_manager", "name": "물품관리사", "wage": 20, "payType": "일당", "slots": 1, "note": ""}, "thief": {"id": "thief", "name": "도둑", "wage": 0, "payType": "자율", "slots": 1, "note": ""}, "announcer": {"id": "announcer", "name": "아나운서", "wage": 10, "payType": "일당", "slots": 1, "note": ""}, "gatekeeper": {"id": "gatekeeper", "name": "문지기", "wage": 10, "payType": "일당", "slots": 1, "note": ""}, "auditor": {"id": "auditor", "name": "감사원", "wage": 100, "payType": "건당", "slots": 1, "note": ""}, "lightning": {"id": "lightning", "name": "번개맨", "wage": 20, "payType": "일당", "slots": 1, "note": ""}, "scribe": {"id": "scribe", "name": "서기", "wage": 20, "payType": "일당", "slots": 1, "note": ""}, "police": {"id": "police", "name": "경찰", "wage": 20, "payType": "일당", "slots": 2, "note": ""}, "board_manager": {"id": "board_manager", "name": "칠판관리사", "wage": 10, "payType": "일당", "slots": 1, "note": ""}, "social_worker": {"id": "social_worker", "name": "사회복지사", "wage": 10, "payType": "일당", "slots": 2, "note": ""}, "accountant": {"id": "accountant", "name": "회계사", "wage": 20, "payType": "일당", "slots": 1, "note": ""}, "tax_office": {"id": "tax_office", "name": "국세청", "wage": 0, "payType": "변동 일당", "slots": 2, "note": ""}, "referee": {"id": "referee", "name": "심판", "wage": 10, "payType": "일당", "slots": 2, "note": ""}, "doctor": {"id": "doctor", "name": "의사", "wage": 0, "payType": "일당", "slots": 1, "note": ""}},
  requests: {},
  workClaims: {},
  taxOfficeWageRecords: {},
  roleWarnings: {},
  classroomNotices: {},
  classroomNoticeStatus: {},
  teacherMessageRooms: {},
  teacherMessages: {},
  dutyNeglect: {},
  marketListings: {},
  marketBoosts: {},
  industryRoles: {},
  industryInventories: {},
  industryDailyActions: {},
  settings:{taxRate:0.1,fineRate:0.05,fineMin:10,fineMax:0,bondDays:7,depositRate:0.05,bondRate:0.03,avatarCreatorRate:0.1},
  dailyEconomyStats:{},
  history:{},
  cosmeticPrices:{},
  avatarCreators:{},
  avatarCloset:{},
  hiddenAvatars:{},
  roomCloset:{},
  roomTemplateCloset:{},
  avatarState:{},
  roomState:{},
  roomTemplateState:{},
  avatarItems:{
    face_1:{id:"face_1",name:"동글눈",type:"face",icon:"▣",price:500,rarity:"일반",assetKey:"face1",style:"cute"},
    face_2:{id:"face_2",name:"반짝눈",type:"face",icon:"▣",price:500,rarity:"일반",assetKey:"face2",style:"bright"},
    face_3:{id:"face_3",name:"웃는눈",type:"face",icon:"▣",price:500,rarity:"일반",assetKey:"face3",style:"happy"},
    face_4:{id:"face_4",name:"차분눈",type:"face",icon:"▣",price:500,rarity:"일반",assetKey:"face4",style:"calm"},
    face_5:{id:"face_5",name:"검정눈",type:"face",icon:"▣",price:500,rarity:"일반",assetKey:"face5",style:"sharp"},
    face_6:{id:"face_6",name:"눈물눈",type:"face",icon:"▣",price:500,rarity:"일반",assetKey:"face6",style:"tear"},
    hair_1:{id:"hair_1",name:"단발 흑발",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair1"},
    hair_2:{id:"hair_2",name:"포니테일",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair2"},
    hair_3:{id:"hair_3",name:"양갈래",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair3"},
    hair_4:{id:"hair_4",name:"긴 생머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair4"},
    hair_5:{id:"hair_5",name:"웨이브 단발",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair5"},
    hair_6:{id:"hair_6",name:"둥근 묶음머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair6"},
    hair_7:{id:"hair_7",name:"사선 앞머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair7"},
    hair_8:{id:"hair_8",name:"옆가르마",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair8"},
    hair_9:{id:"hair_9",name:"짧은 삐죽머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair9"},
    hair_10:{id:"hair_10",name:"강한 삐죽머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair10"},
    hair_11:{id:"hair_11",name:"버섯머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair11"},
    hair_12:{id:"hair_12",name:"가른 단발",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair12"},
    hair_13:{id:"hair_13",name:"긴 옆머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair13"},
    hair_14:{id:"hair_14",name:"높은 묶음",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair14"},
    hair_15:{id:"hair_15",name:"중간 장발",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair15"},
    hair_16:{id:"hair_16",name:"짧은 남자머리",type:"hair",icon:"▣",price:500,rarity:"일반",assetKey:"hair16"},
    top_1:{id:"top_1",name:"기본 티셔츠",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top1"},
    top_2:{id:"top_2",name:"베이지 후드티",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top2"},
    top_3:{id:"top_3",name:"올리브 니트",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top3"},
    top_4:{id:"top_4",name:"리본 블라우스",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top4"},
    top_5:{id:"top_5",name:"세일러 상의",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top5"},
    top_6:{id:"top_6",name:"흰 셔츠",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top6"},
    top_7:{id:"top_7",name:"베이지 가디건",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top7"},
    top_8:{id:"top_8",name:"청자켓",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top8"},
    top_9:{id:"top_9",name:"버튼 원피스",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top9"},
    top_10:{id:"top_10",name:"야구 티셔츠",type:"top",icon:"▣",price:500,rarity:"일반",assetKey:"top10"},
    bottom_1:{id:"bottom_1",name:"흰 반바지",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom1"},
    bottom_2:{id:"bottom_2",name:"연청 바지",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom2"},
    bottom_3:{id:"bottom_3",name:"베이지 바지",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom3"},
    bottom_4:{id:"bottom_4",name:"검정 바지",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom4"},
    bottom_5:{id:"bottom_5",name:"검정 레깅스",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom5"},
    bottom_6:{id:"bottom_6",name:"분홍 치마",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom6"},
    bottom_7:{id:"bottom_7",name:"하늘 치마",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom7"},
    bottom_8:{id:"bottom_8",name:"체크 치마",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom8"},
    bottom_9:{id:"bottom_9",name:"민트 반바지",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom9"},
    bottom_10:{id:"bottom_10",name:"회색 조거",type:"bottom",icon:"▣",price:500,rarity:"일반",assetKey:"bottom10"}
  },
  roomItems:{
    wall_wood:{id:"wall_wood",name:"기본 벽지",type:"wallpaper",icon:"▣",price:120,rarity:"일반",src:"assets/room/wall_decor.png",order:1},
    floor_wood:{id:"floor_wood",name:"나무 바닥",type:"floor",icon:"▣",price:100,rarity:"일반",src:"assets/room/floor_wood.png",order:2},
    window_01:{id:"window_01",name:"큰 창문",type:"window",icon:"▣",price:160,rarity:"일반",src:"assets/room/window_01.png",x:168,y:74,w:132,h:182,z:38,order:10},
    poster_01:{id:"poster_01",name:"액자",type:"decor",icon:"▣",price:100,rarity:"일반",src:"assets/room/poster_01.png",x:420,y:96,w:48,h:68,z:44,order:11},
    clock_01:{id:"clock_01",name:"사진 세트",type:"decor",icon:"▣",price:90,rarity:"일반",src:"assets/room/photo_set_01.png",x:374,y:64,w:74,h:64,z:42,order:12},
    bed_01:{id:"bed_01",name:"고양이 침대",type:"furniture",icon:"▣",price:180,rarity:"일반",src:"assets/room/bed_01.png",x:116,y:232,w:166,h:130,z:172,order:20},
    sofa_01:{id:"sofa_01",name:"파란 라탄 의자",type:"furniture",icon:"▣",price:220,rarity:"일반",src:"assets/room/blue_chair_01.png",x:306,y:232,w:98,h:108,z:198,order:21},
    desk_01:{id:"desk_01",name:"나무 책상",type:"furniture",icon:"▣",price:150,rarity:"일반",src:"assets/room/desk_01.png",x:360,y:250,w:128,h:110,z:214,order:22},
    pc_01:{id:"pc_01",name:"수납장",type:"furniture",icon:"▣",price:250,rarity:"일반",src:"assets/room/cabinet_01.png",x:346,y:160,w:132,h:122,z:128,order:23},
    chair_01:{id:"chair_01",name:"기본 벤치",type:"furniture",icon:"▣",price:120,rarity:"일반",src:"assets/room/bench_01.png",x:126,y:308,w:110,h:116,z:248,order:24},
    table_01:{id:"table_01",name:"러그 테이블",type:"furniture",icon:"▣",price:180,rarity:"일반",src:"assets/room/table_rug_01.png",x:238,y:294,w:176,h:112,z:256,order:25},
    rug_01:{id:"rug_01",name:"파란 러그",type:"rug",icon:"▣",price:160,rarity:"일반",src:"assets/room/rug_01.png",x:374,y:324,w:152,h:88,z:238,order:26},
    bookshelf_01:{id:"bookshelf_01",name:"장식 선반",type:"furniture",icon:"▣",price:200,rarity:"일반",src:"assets/room/shelf_01.png",x:354,y:126,w:132,h:72,z:86,order:27},
    aquarium_01:{id:"aquarium_01",name:"민트 의자",type:"furniture",icon:"▣",price:170,rarity:"일반",src:"assets/room/aqua_stool_01.png",x:298,y:322,w:78,h:64,z:264,order:28},
    lamp_01:{id:"lamp_01",name:"주전자 의자",type:"furniture",icon:"▣",price:110,rarity:"일반",src:"assets/room/kettle_stool_01.png",x:96,y:326,w:68,h:78,z:266,order:29},
    plant_01:{id:"plant_01",name:"화분",type:"plant",icon:"▣",price:90,rarity:"일반",src:"assets/room/plant_01.png",x:428,y:238,w:66,h:104,z:226,order:30},
    guitar_01:{id:"guitar_01",name:"기타",type:"decor",icon:"▣",price:220,rarity:"일반",src:"assets/room/guitar_01.png",x:474,y:242,w:66,h:126,z:286,order:31}
  }
};

const PIXEL_ASSETS = {};




let data = structuredClone(defaultData);
let derived = {students:[],ledger:[],ledgerByDay:{},ledgerByAccount:{},balances:{},centralByEntry:{},organizationAccountIds:[]};
let mode = localStorage.getItem("economyMode") || cfg("ux.defaultMode","student");
let currentTab = "dashboard";
let selectedStudent = localStorage.getItem("selectedStudent") || "";
let studentTab = localStorage.getItem("studentTab") || cfg("ux.defaultStudentTab","assets");
let selectedBankbook = "";
let selectedNoticeStudentTab = localStorage.getItem("studentNoticeTab") || "today";
let selectedTeacherNoticeTab = localStorage.getItem("teacherNoticeTab") || "create";
let activeMobilePage = localStorage.getItem("activeMobilePage") || "";
let activeMobileTeacherPage = localStorage.getItem("activeMobileTeacherPage") || "";
let selectedTeacherMessageRoom = localStorage.getItem("teacherMessageRoom") || "";
let selectedTeacherNoticeDetail = localStorage.getItem("teacherNoticeDetail") || "";
let teacherMessageSearch = "";
let noticeUncheckedOnly = false;
let studentNoticeUnsubs = [];
let teacherNoticeUnsubs = [];
let activeMessageUnsub = null;
let subscribedNoticeStudent = "";
let noticeState = {all:[],student:[],statuses:[],studentStatuses:{},teacherStatuses:[],rooms:[],studentRoom:null,messages:[]};
let lastStudentMessageSentAt = 0;
let bankLedgerDateFilter = "";
let bankLedgerPage = 1;
const BANK_LEDGER_PAGE_SIZE = 8;
let marketCategory = localStorage.getItem("marketCategory") || "전체";
let marketSearch = localStorage.getItem("marketSearch") || "";
let marketPage = Math.max(1, Number(localStorage.getItem("marketPage") || "1"));
let marketSort = localStorage.getItem("marketSort") || "boost";
let uiEditing = false;
let pendingRealtimeRender = false;
let renderTimer = 0;
function isEditingElement(el){return el && ["INPUT","SELECT","TEXTAREA"].includes(el.tagName)}
function scheduleRender(delay=80){
  clearTimeout(renderTimer);
  renderTimer=setTimeout(()=>{
    if(uiEditing && isEditingElement(document.activeElement)){
      pendingRealtimeRender = true;
      return;
    }
    render();
  },delay);
}
document.addEventListener("focusin", e=>{ if(isEditingElement(e.target)) uiEditing=true; });
document.addEventListener("focusout", e=>{
  if(isEditingElement(e.target)){
    setTimeout(()=>{
      if(!isEditingElement(document.activeElement)){
        uiEditing=false;
        if(pendingRealtimeRender){pendingRealtimeRender=false; scheduleRender();}
      }
    },250);
  }
});


function catalogMap(source){
  if(!source || typeof source!=="object") return {};
  const entries=Array.isArray(source) ? source.map(item=>[item?.id,item]) : Object.entries(source);
  return entries.reduce((acc,[key,item])=>{
    if(!item || typeof item!=="object") return acc;
    const id=item.id || key;
    if(!id) return acc;
    acc[id]={...item,id};
    return acc;
  },{});
}
function applyCatalogExtensions(){
  const ext=window.ECONOMY_CATALOG_EXTENSIONS || {};
  Object.assign(CUSTOM_AVATARS,catalogMap(ext.avatarItems || ext.avatars));
  Object.assign(defaultData.roomItems,catalogMap(ext.roomItems || ext.miniRoomItems));
  Object.assign(MINIROOM_TEMPLATES,catalogMap(ext.roomTemplates || ext.miniRooms));
  const industry=ext.industry || {};
  Object.assign(INDUSTRY_CATALOG.roles,catalogMap(industry.roles));
  Object.assign(INDUSTRY_CATALOG.materials,catalogMap(industry.materials));
  Object.assign(INDUSTRY_CATALOG.products,catalogMap(industry.products));
}
applyCatalogExtensions();
function ensureRequiredEconomyExtensions(){
  defaultData.workClaims = defaultData.workClaims || {};
  defaultData.taxOfficeWageRecords = defaultData.taxOfficeWageRecords || {};
  defaultData.jobWageRules = defaultData.jobWageRules || {};
  defaultData.products = defaultData.products || {};
  Object.entries(SNACK_PRODUCT_DEFAULTS).forEach(([id,defaults])=>{
    defaultData.products[id]={id,...defaults,...obj(defaultData.products[id])};
  });
  if(!defaultData.jobs.snack_retailer){
    defaultData.jobs.snack_retailer={id:"snack_retailer",name:"과자 소매상",wage:0,payType:"자율",slots:4,note:"과자 도매 구매 후 판매 재고를 관리합니다."};
  }
}
ensureRequiredEconomyExtensions();
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function money(v){return Math.round(n(v))}
function fmt(v){return money(v).toLocaleString("ko-KR")}
function won(v){return fmt(v)+"열매"}
function localDateString(d=new Date()){
  const x=new Date(d);
  const y=x.getFullYear();
  const m=String(x.getMonth()+1).padStart(2,"0");
  const day=String(x.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function today(){return localDateString(new Date())}
function now(){return new Date().toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}
function seoulDate(d=new Date()){return new Date(new Date(d).getTime()+9*60*60*1000)}
function seoulIsoString(d=new Date()){
  const x=seoulDate(d);
  const y=x.getUTCFullYear();
  const m=String(x.getUTCMonth()+1).padStart(2,"0");
  const day=String(x.getUTCDate()).padStart(2,"0");
  const hh=String(x.getUTCHours()).padStart(2,"0");
  const mm=String(x.getUTCMinutes()).padStart(2,"0");
  const ss=String(x.getUTCSeconds()).padStart(2,"0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}+09:00`;
}
function seoulDateTimeText(ts){
  if(!ts) return "-";
  const d=new Date(ts);
  if(Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function seoulDateShortText(ts){
  if(!ts) return "-";
  const d=new Date(ts);
  if(Number.isNaN(d.getTime())) return String(ts).slice(0,10) || "-";
  return d.toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit"}).replace(/\.\s?/g,".").replace(/\.$/,"");
}
function obj(o){return o || {}}
function arr(o){return Object.values(o || {})}
function escapeHtml(text=""){
  return String(text).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function sid(){return "s_" + Math.random().toString(36).slice(2,9)}
function txid(){return "tx_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,6)}
function toast(msg){const old=document.querySelector(".toast"); if(old) old.remove(); const el=document.createElement("div"); el.className="toast"; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),cfgNum("ux.toastMs",2600))}
function dbSet(path, value){return set(ref(db, "classEconomy/main/" + path), value)}
function dbUpdate(path, value){return update(ref(db, "classEconomy/main/" + path), value)}
function dbRemove(path){return remove(ref(db, "classEconomy/main/" + path))}
function mergeDefaults(base, incoming){
  if(!incoming) return structuredClone(base);
  const out = structuredClone(base);
  function rec(t,s){for(const k in s){if(s[k] && typeof s[k]==="object" && !Array.isArray(s[k]) && t[k] && typeof t[k]==="object") rec(t[k],s[k]); else t[k]=s[k];} return t}
  return rec(out,incoming);
}
function rebuildDerivedState(){
  const ledger=arr(data.ledger);
  const balances={};
  const ledgerByDay={};
  const ledgerByAccount={};
  const centralByEntry={};
  const organizationIds=new Set();
  ledger.forEach(e=>{
    const day=dayOfEntry(e) || today();
    if(!ledgerByDay[day]) ledgerByDay[day]=[];
    ledgerByDay[day].push(e);
    let central=0;
    arr(e.lines).forEach(l=>{
      const account=String(l.account||"");
      const delta=money(l.delta);
      if(!account) return;
      balances[account]=money(n(balances[account])+delta);
      if(!ledgerByAccount[account]) ledgerByAccount[account]=[];
      ledgerByAccount[account].push(e);
      if(account===CENTRAL) central+=delta;
      else if(!obj(data.students)[account]) organizationIds.add(account);
    });
    centralByEntry[e.id || e.ts || Math.random().toString(36)]=central;
  });
  Object.values(ledgerByDay).forEach(rows=>rows.sort((a,b)=>(a.ts||"").localeCompare(b.ts||"")));
  Object.values(ledgerByAccount).forEach(rows=>rows.sort((a,b)=>(a.ts||"").localeCompare(b.ts||"")));
  derived={students:arr(data.students),ledger,ledgerByDay,ledgerByAccount,balances,centralByEntry,organizationAccountIds:[...organizationIds]};
}
function snackProductRepairUpdates(){
  const updates={};
  const existing=obj(data.products);
  Object.entries(SNACK_PRODUCT_DEFAULTS).forEach(([defaultId,defaults])=>{
    const found=Object.entries(existing).find(([id,p])=>id===defaultId || p?.name===defaults.name);
    const id=found?.[0] || defaultId;
    const current=obj(found?.[1]);
    const next={...defaults,id,name:defaults.name};
    Object.entries(next).forEach(([key,value])=>{
      if(current[key]!==value) updates[`products/${id}/${key}`]=value;
    });
  });
  return updates;
}
async function repairSnackProductDefaultsIfNeeded(){
  if(snackDefaultsRepairQueued || snackDefaultsRepairCompleted) return;
  const updates=snackProductRepairUpdates();
  if(!Object.keys(updates).length){snackDefaultsRepairCompleted=true; return;}
  snackDefaultsRepairQueued=true;
  try{ await dbUpdate("",updates); }
  catch(e){ console.warn("snack product defaults repair failed", e); }
  finally{ snackDefaultsRepairQueued=false; snackDefaultsRepairCompleted=true; }
}
function student(id){return obj(data.students)[id]}
function studentName(id){return id===CENTRAL ? "중앙은행" : (student(id)?.name || "알 수 없음")}
function students(){return derived.students?.length ? derived.students : arr(data.students)}
function balanceOf(id){
  return money(obj(derived.balances)[id])
}
function centralDelta(e){return e?.id && derived.centralByEntry[e.id]!==undefined ? n(derived.centralByEntry[e.id]) : arr(e.lines).filter(l=>l.account===CENTRAL).reduce((a,l)=>a+n(l.delta),0)}
function todayG(){return ledgerForDay(today()).reduce((sum,e)=>sum + Math.max(0,-centralDelta(e)),0)}
function todayT(){return ledgerForDay(today()).reduce((sum,e)=>sum + Math.max(0,centralDelta(e)),0)}
function todayY(){return todayG()-todayT()}
function tax(amount){return money(n(amount)*n(data.settings.taxRate))}
function fineAmount(id){return calculateFineAmount(id).fineAmount}
function bondCurrentValueOf(id){
  return arr(data.bonds)
    .filter(b=>b.owner===id && b.status==="active")
    .reduce((sum,b)=>sum+money(n(b.principal)*(1+n(b.rate)/100)),0);
}

function idLabel(id){return student(id)?.name || id || "-"}
function corporationCollection(){return obj(data.corporations || data.companies || data.corporateEntities)}
function corporationRaw(id){return obj(corporationCollection())[id] || null}
function corporationCashBalance(c){
  if(!c) return 0;
  const accountId=c.cashAccountId || c.accountId || c.id;
  const ledgerBalance=accountId ? money(balanceOf(accountId)) : 0;
  if(ledgerBalance!==0) return ledgerBalance;
  if(c.cashBalance!==undefined) return money(c.cashBalance);
  if(c.balance!==undefined) return money(c.balance);
  return 0;
}
function corporationMembers(c){
  const set=new Set();
  const add=v=>{ if(v && student(v)) set.add(v); };
  const members=c?.members ?? c?.memberIds ?? c?.studentIds ?? c?.owners;
  if(Array.isArray(members)) members.forEach(add);
  else if(members && typeof members==="object") Object.entries(members).forEach(([k,v])=>{ if(v===true || v===1 || v==="true") add(k); else if(typeof v==="string") add(v); else add(k); });
  Object.keys(obj(c?.shareholders)).forEach(add);
  add(c?.representativeStudentId || c?.representativeId || c?.leaderId || c?.ownerId);
  return [...set];
}
function distributeShares(memberIds,preferredId=""){
  const ids=[...new Set(memberIds.filter(id=>student(id)))];
  if(!ids.length) return {};
  const base=Math.floor(100/ids.length), rem=100-base*ids.length;
  const ordered=preferredId && ids.includes(preferredId) ? [preferredId,...ids.filter(id=>id!==preferredId)] : ids;
  const out={};
  ordered.forEach((id,i)=>out[id]=base+(i<rem?1:0));
  return out;
}
function corporationShareholders(c){
  const raw=obj(c?.shareholders || c?.shares || c?.holders);
  const out={};
  Object.entries(raw).forEach(([id,v])=>{
    const shares=money(typeof v==="object" ? (v.shares ?? v.amount ?? v.count ?? 0) : v);
    if(student(id) && shares>0) out[id]=shares;
  });
  if(Object.keys(out).length) return out;
  return distributeShares(corporationMembers(c), c?.representativeStudentId || c?.representativeId || c?.leaderId || "");
}
function corporationShareTotal(c){return Object.values(corporationShareholders(c)).reduce((a,b)=>a+n(b),0)}
function corporationNetAssetValue(c){
  const explicit=c?.netAssetValue ?? c?.officialNetAssetValue;
  if(explicit!==undefined) return money(explicit);
  return money(corporationCashBalance(c)+n(c?.inventoryValue)+n(c?.receivables)-n(c?.debt));
}
function corporationOfficialSharePrice(c){
  const explicit=c?.officialSharePrice;
  if(explicit!==undefined && n(explicit)>0) return money(explicit);
  return money(corporationNetAssetValue(c)/100);
}
function normalizeCorporation(id,c){
  const row={...(c||{}),id:id || c?.id};
  row.name=row.name || row.title || `법인 ${row.id}`;
  row.totalShares=n(row.totalShares)||100;
  row.shareholders=corporationShareholders(row);
  row.representativeStudentId=resolveCorporationRepresentative(row,row.representativeStudentId || row.representativeId || row.leaderId || "");
  row.netAssetValue=corporationNetAssetValue(row);
  row.officialSharePrice=corporationOfficialSharePrice(row);
  row.shareTotal=Object.values(row.shareholders).reduce((a,b)=>a+n(b),0);
  return row;
}
function corporations(){
  return Object.entries(corporationCollection()).map(([id,c])=>normalizeCorporation(id,c)).sort((a,b)=>(a.name||"").localeCompare(b.name||"","ko"));
}
function corporationById(id){
  const c=corporationRaw(id);
  return c ? normalizeCorporation(id,c) : null;
}
function resolveCorporationRepresentative(c,current=""){
  const holders=corporationShareholders(c);
  const rows=Object.entries(holders).filter(([,v])=>n(v)>0).sort((a,b)=>n(b[1])-n(a[1]) || idLabel(a[0]).localeCompare(idLabel(b[0]),"ko"));
  if(!rows.length) return "";
  const max=n(rows[0][1]);
  const leaders=rows.filter(([,v])=>n(v)===max).map(([id])=>id);
  if(current && leaders.includes(current)) return current;
  return leaders.length===1 ? leaders[0] : (current || leaders[0]);
}
function studentCorporationShares(studentId){
  return corporations().map(c=>{
    const shares=n(c.shareholders[studentId]);
    return shares>0 ? {corporation:c,shares,value:money(shares*c.officialSharePrice)} : null;
  }).filter(Boolean);
}
function openShareSellOrders(){return arr(data.shareSellOrders).filter(o=>o && o.status==="open").sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))}
function shareSellOrdersForCorporation(corpId){return openShareSellOrders().filter(o=>o.corporationId===corpId)}
function openShareSellAmount(studentId,corpId){return openShareSellOrders().filter(o=>o.sellerStudentId===studentId && o.corporationId===corpId).reduce((sum,o)=>sum+n(o.shareAmount),0)}
function availableCorporationShares(studentId,corpId){const c=corporationById(corpId); return Math.max(0,n(c?.shareholders?.[studentId])-openShareSellAmount(studentId,corpId))}
function updateRepresentativeFields(updates,corpId,nextCorp,previousRepresentative=""){
  const rep=resolveCorporationRepresentative(nextCorp,previousRepresentative);
  updates[`corporations/${corpId}/representativeStudentId`]=rep || null;
  if(rep && rep!==previousRepresentative){
    const hid=`rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
    updates[`corporateRepresentativeHistory/${hid}`]={id:hid,corporationId:corpId,previousRepresentativeStudentId:previousRepresentative||"",newRepresentativeStudentId:rep,reason:"shareholder_change",changedAt:new Date().toISOString()};
  }
  return rep;
}
function corporationLegacyEquityValueOf(id){
  const equities=obj(data.corporateEquities || data.companyShares || data.corporateShares);
  return Object.values(equities).reduce((sum,row)=>{
    if(!row || typeof row!=="object") return sum;
    if(row.studentId===id || row.owner===id || row.ownerId===id) return sum+money(row.value ?? row.amount ?? row.equityValue ?? 0);
    const holders=obj(row.holders || row.shareholders || row.owners);
    const h=holders[id];
    if(h && typeof h==="object") return sum+money(h.value ?? h.amount ?? h.equityValue ?? 0);
    return sum+money(h||0);
  },0);
}
function corporateEquityValueOf(id){
  const fromCorporations=studentCorporationShares(id).reduce((sum,row)=>sum+money(row.value),0);
  return money(fromCorporations+corporationLegacyEquityValueOf(id));
}

function fineAssetSnapshot(id){
  const personalCash=money(balanceOf(id));
  const deposits=money(obj(data.deposits)[id]);
  const savings=money(savingsValueOf(id));
  const bonds=money(bondCurrentValueOf(id));
  const ticketsValue=money(ticketValueOf(id));
  const corporateEquityValue=money(corporateEquityValueOf(id));
  const totalFineBaseAssets=money(personalCash+deposits+savings+bonds+ticketsValue+corporateEquityValue);
  return {personalCash,deposits,savings,bonds,ticketsValue,corporateEquityValue,totalFineBaseAssets};
}
function fineMaxAmount(){
  const configured=money(data.settings?.fineMax);
  if(configured>0) return configured;
  return Math.max(money(currentEconomyStats(today()).averageHoldingPerStudent/5), money(data.settings?.fineMin)||10);
}
function calculateFineAmount(id){
  const assetSnapshot=fineAssetSnapshot(id);
  const fineRate=n(data.settings?.fineRate)||0.05;
  const minFine=money(data.settings?.fineMin || 10);
  const maxFine=fineMaxAmount();
  const raw=money(assetSnapshot.totalFineBaseAssets*fineRate);
  const fineAmount=money(clampNum(raw,minFine,maxFine));
  return {assetSnapshot,fineRate,minFine,maxFine,raw,fineAmount};
}
function fineDueDate(issuedAtIso){
  const d=new Date(issuedAtIso || new Date().toISOString());
  d.setDate(d.getDate()+7);
  return d.toISOString().slice(0,10);
}
function fineRowsForStudent(id){
  return arr(data.fines).filter(f=>f.studentId===id).sort((a,b)=>(b.issuedAt||"").localeCompare(a.issuedAt||""));
}
function remainingFineAmount(f){return Math.max(0,money(f.remainingAmount ?? (n(f.fineAmount)-n(f.paidAmount))))}
function fineEffectiveStatus(f){
  const status=f.status || "unpaid";
  if(status==="paid" || status==="cancelled") return status;
  if(f.dueDate && f.dueDate<today()) return "overdue";
  return remainingFineAmount(f)<n(f.fineAmount) ? "partial" : status;
}
function unpaidFinesForStudent(id){
  return fineRowsForStudent(id).filter(f=>!["paid","cancelled"].includes(fineEffectiveStatus(f)) && remainingFineAmount(f)>0);
}
function hasUnpaidFine(id){return unpaidFinesForStudent(id).length>0}
function overdueFineCount(id){return unpaidFinesForStudent(id).filter(f=>fineEffectiveStatus(f)==="overdue").length}
function requireCash(id, amount){if(balanceOf(id)<money(amount)){toast(`${studentName(id)} 잔고 부족: 필요 ${won(amount)}, 현재 ${won(balanceOf(id))}`); return false} return true}
function round10(x){return Math.round(n(x)/10)*10}
function isTopDisplayTicket(k){return k==="topDisplay"}
function clampNum(value,min,max){return Math.min(Math.max(n(value),min),max)}
function pct(v){return `${v>0?"+":""}${(Math.round(n(v)*10)/10).toFixed(1)}%`}
function signedWon(v){return `${n(v)>=0?"+":"-"}${won(Math.abs(v))}`}
function activeStudents(){return students().filter(s=>s && s.id && s.active!==false)}
function activeStudentCount(){return Math.max(1,activeStudents().length)}
function dayOfEntry(e){return String(e?.day || e?.date || (e?.ts||"").slice(0,10) || "").slice(0,10)}
function ledgerForDay(day){return obj(derived.ledgerByDay)[day] || []}
function typeText(e){return String(e?.type || "")}
function isIssuedIncomeEntry(e){
  const t=typeText(e);
  const positiveTypes=["초기지급","일괄지급","직업임금","지급","전체지급","예금이자","상세지급"];
  return positiveTypes.some(x=>t.includes(x));
}
function issuedIncomeOnDay(day=today()){
  return ledgerForDay(day)
    .filter(isIssuedIncomeEntry)
    .reduce((sum,e)=>sum+Math.max(0,-centralDelta(e)),0);
}
function burnedAmountOnDay(day=today()){
  return ledgerForDay(day).reduce((sum,e)=>sum+Math.max(0,centralDelta(e)),0);
}
function previousDays(day=today(),count=5){
  const out=[];
  const d=new Date(day+"T00:00:00");
  for(let i=1;i<=count;i++){
    const x=new Date(d);
    x.setDate(d.getDate()-i);
    out.push(x.toISOString().slice(0,10));
  }
  return out;
}
function recentIssuedIncomeAverage(day=today()){
  const values=previousDays(day,5).map(d=>{
    const saved=obj(data.dailyEconomyStats)[d];
    return saved && typeof saved==="object" && saved.issuedIncome!==undefined ? n(saved.issuedIncome) : issuedIncomeOnDay(d);
  }).filter(v=>v>0);
  if(!values.length) return Math.max(1,issuedIncomeOnDay(day),n(data.previousIncome));
  return values.reduce((a,b)=>a+b,0)/values.length;
}
function organizationAccountIds(){
  return derived.organizationAccountIds || [];
}
function organizationCashTotal(){
  return organizationAccountIds().reduce((sum,id)=>sum+balanceOf(id),0);
}
function classEconomyStatsBase(day=today()){
  const studentCash=activeStudents().reduce((sum,s)=>sum+balanceOf(s.id),0);
  const organizationCash=organizationCashTotal();
  const deposits=activeStudents().reduce((sum,s)=>sum+n(obj(data.deposits)[s.id]),0);
  const savings=activeStudents().reduce((sum,s)=>sum+savingsValueOf(s.id),0);
  const bonds=arr(data.bonds).filter(b=>b.status==="active" && student(b.owner)).reduce((sum,b)=>sum+n(b.principal),0);
  const liquidHoldings=money(studentCash+organizationCash);
  const lockedHoldings=money(deposits+savings+bonds);
  const totalHoldings=money(liquidHoldings+lockedHoldings);
  const issuedIncome=money(issuedIncomeOnDay(day));
  const burnedAmount=money(burnedAmountOnDay(day));
  return {
    date:day,
    studentCount:activeStudentCount(),
    totalHoldings,
    liquidHoldings,
    lockedHoldings,
    issuedIncome,
    burnedAmount,
    netChange:money(issuedIncome-burnedAmount),
    averageHoldingPerStudent:money(totalHoldings/activeStudentCount())
  };
}
function ticketDemandCounts(ticketId,day=today()){
  let buyOrders=0, sellOrders=0;
  arr(data.requests).forEach(r=>{
    if(r.ticketId!==ticketId) return;
    const rday=String((r.ts||"").slice(0,10) || day);
    if(rday && rday!==day) return;
    if(r.type==="ticketBuy") buyOrders++;
    if(r.type==="ticketSell") sellOrders++;
  });
  ledgerForDay(day).forEach(e=>{
    if(obj(e.meta).ticketId!==ticketId) return;
    const t=typeText(e);
    if(t.includes("티켓구매")) buyOrders++;
    if(t.includes("티켓판매")) sellOrders++;
  });
  return {buyOrders,sellOrders};
}
function ticketBaseFromAverage(ticketId,averageHolding){
  if(ticketId==="personalClean") return n(averageHolding)/5;
  if(ticketId==="playHour") return n(averageHolding)*3;
  return n(averageHolding);
}
function previousTicketClose(ticketId,day=today()){
  const rows=economyHistoryRows(null, false).filter(r=>r.day<day && r.ticketPrices?.[ticketId]);
  const last=rows[rows.length-1];
  return n(last?.ticketPrices?.[ticketId]?.close || last?.ticketPrices?.[ticketId]?.buy || 0);
}
function ticketScarcityMultiplier(ticketId,stockOverride=null){
  if(isTopDisplayTicket(ticketId)) return 1;
  const t=ticketData(ticketId);
  const initialStock=Math.max(1,n(t.supply));
  const currentStock=clampNum(stockOverride===null ? n(t.stock) : n(stockOverride),0,initialStock);
  const stockRatio=currentStock/initialStock;
  return clampNum(1+(1-stockRatio)*TICKET_SCARCITY_WEIGHT,MIN_TICKET_PRICE_MULTIPLIER,MAX_TICKET_PRICE_MULTIPLIER);
}
function calculateTicketPrice(ticketId,baseStats=classEconomyStatsBase(today()),stockOverride=null){
  if(isTopDisplayTicket(ticketId)) return {base:5,close:5,open:5,high:5,low:5,change:0,changeRate:0,buyOrders:0,sellOrders:0,incomeCorrection:1,demandCorrection:1,scarcityMultiplier:1};
  const day=baseStats.date || today();
  const base=Math.max(1,ticketBaseFromAverage(ticketId,baseStats.averageHoldingPerStudent));
  const averageIssued=recentIssuedIncomeAverage(day);
  const incomeCorrection=clampNum(averageIssued>0 ? n(baseStats.issuedIncome)/averageIssued : 1,0.9,1.1);
  const demand=ticketDemandCounts(ticketId,day);
  const demandCorrection=clampNum(1+((demand.buyOrders-demand.sellOrders)/activeStudentCount())*0.3,0.85,1.2);
  const scarcityMultiplier=ticketScarcityMultiplier(ticketId,stockOverride);
  const temporary=base*incomeCorrection*demandCorrection*scarcityMultiplier;
  const previous=previousTicketClose(ticketId,day) || base;
  const close=money(clampNum(temporary,previous*0.8,previous*1.25));
  const open=money(previous);
  const change=money(close-open);
  const changeRate=open>0 ? (change/open)*100 : 0;
  return {
    base:money(base),
    open,
    close,
    high:Math.max(open,close),
    low:Math.min(open,close),
    change,
    changeRate,
    buyOrders:demand.buyOrders,
    sellOrders:demand.sellOrders,
    incomeCorrection,
    demandCorrection,
    scarcityMultiplier
  };
}
function currentEconomyStats(day=today()){
  const base=classEconomyStatsBase(day);
  const ticketPrices={};
  Object.keys(ticketMeta).forEach(k=>{ ticketPrices[k]=calculateTicketPrice(k,base); });
  return {...base,ticketPrices};
}
function ticketPriceInfo(k){return calculateTicketPrice(k,classEconomyStatsBase(today()))}
function ticketBuyPriceInfo(k){
  if(isTopDisplayTicket(k)) return ticketPriceInfo(k);
  const t=ticketData(k);
  const sellInfo=ticketPriceInfo(k);
  const buyInfo=calculateTicketPrice(k,classEconomyStatsBase(today()),n(t.stock)-1);
  if(n(t.stock)>0 && buyInfo.close<=sellInfo.close){
    buyInfo.close=money(sellInfo.close+1);
    buyInfo.high=Math.max(buyInfo.open,buyInfo.close);
    buyInfo.low=Math.min(buyInfo.open,buyInfo.close);
    buyInfo.change=money(buyInfo.close-buyInfo.open);
    buyInfo.changeRate=buyInfo.open>0 ? (buyInfo.change/buyInfo.open)*100 : 0;
  }
  return buyInfo;
}
function basePrice(k){return isTopDisplayTicket(k)?5:ticketPriceInfo(k).base}
function ticketUnit(k){return 0}
function ticketStoredDate(raw){
  const base=obj(raw);
  return String(base.date || base.DATE || base.day || "").slice(0,10);
}
function normalizeTicketState(raw){
  const base=obj(raw);
  const fallbackSupply=n(base.supply)||10;
  const supply=Math.max(1,fallbackSupply);
  const hasSold=Object.prototype.hasOwnProperty.call(base,"sold");
  const hasStock=Object.prototype.hasOwnProperty.call(base,"stock");
  const inferredSold=hasStock ? supply-n(base.stock) : 0;
  const soldFromRaw=clampNum(base.sold,0,supply);
  const soldFromStock=clampNum(inferredSold,0,supply);
  const rawStock=clampNum(base.stock,0,supply);
  const stockDiffers=hasSold && hasStock && rawStock!==supply-soldFromRaw;
  const sold=hasStock && (!hasSold || stockDiffers) ? soldFromStock : soldFromRaw;
  const out={...base,supply,sold,stock:Math.max(0,supply-sold)};
  const storedDate=ticketStoredDate(base);
  if(storedDate) out.date=storedDate;
  delete out.DATE;
  return out;
}
function ticketData(k){
  const meta=ticketMeta[k]||{};
  const defaults=isTopDisplayTicket(k)?{supply:20,sold:0,stock:20,date:today()}:{supply:10,sold:0,stock:10};
  const current=obj(data.tickets)[k];
  const def=obj(defaultData.tickets)[k];
  const state=normalizeTicketState({...defaults,...obj(def),...obj(current)});
  if(isTopDisplayTicket(k) && ticketStoredDate(state)!==today()){
    return normalizeTicketState({supply:n(meta.dailySupply)||20,sold:0,stock:n(meta.dailySupply)||20,date:today()});
  }
  return state;
}
function ticketSold(k){const t=ticketData(k); return clampNum(n(t.sold),0,Math.max(1,n(t.supply)))}
function ticketStock(k){return n(ticketData(k).stock)}
function ticketStockHtml(k){
  const stock=ticketStock(k);
  return `<span class="ticketStockBadge ${stock<=0?"zero":""}">재고 ${stock}장</span>`;
}
function ticketBuy(k){
  if(isTopDisplayTicket(k)) return 5;
  return ticketBuyPriceInfo(k).close;
}
function ticketSell(k){
  if(isTopDisplayTicket(k)) return 5;
  return ticketPriceInfo(k).close;
}
function snackDefaultForProduct(p){
  const byId=SNACK_PRODUCT_DEFAULTS[p?.id];
  if(byId) return byId;
  return Object.values(SNACK_PRODUCT_DEFAULTS).find(x=>x.name===p?.name) || null;
}
function normalizeSnackProduct(p,id=""){
  if(!p && !id) return null;
  const base={id,...obj(p)};
  const defaults=snackDefaultForProduct(base) || SNACK_PRODUCT_DEFAULTS[id];
  if(!defaults) return base;
  return {...defaults,...base,id:base.id||id,name:base.name||defaults.name};
}
function product(id){return normalizeSnackProduct(obj(data.products)[id],id)}
function snackEconomyIndex(day=today()){
  return money(currentEconomyStats(day).totalHoldings || 0);
}
function calculateSnackPrice(snack,economyIndex,defaultBaseEconomyIndex=100){
  if(!snack) return 0;
  if(snack.priceType==="fixed") return Math.round(Number(snack.fixedPrice ?? snack.price ?? 0));
  if(snack.priceType==="economyIndex"){
    const basePrice=Number(snack.basePrice ?? snack.price ?? 0);
    const baseEconomyIndex=Number(snack.baseEconomyIndex ?? defaultBaseEconomyIndex);
    const sensitivity=Number(snack.sensitivity ?? 1);
    const safeEconomyIndex=Number(economyIndex);
    if(!safeEconomyIndex || !baseEconomyIndex || baseEconomyIndex<=0) return Math.round(basePrice);
    const rawPrice=basePrice*Math.pow(safeEconomyIndex/baseEconomyIndex,sensitivity);
    const minPrice=Number(snack.minPrice ?? 1);
    const maxPrice=snack.maxPrice!=null ? Number(snack.maxPrice) : Infinity;
    return Math.round(Math.max(minPrice,Math.min(maxPrice,rawPrice)));
  }
  return Math.round(Number(snack.price ?? snack.fixedPrice ?? snack.basePrice ?? 0));
}
function calculateSnackWholesalePrice(snack,economyIndex){
  const retailReferencePrice=calculateSnackPrice(snack,economyIndex);
  const wholesaleRate=Number(snack?.wholesaleRate ?? 0.65);
  return Math.round(retailReferencePrice*wholesaleRate);
}
function productPriceAtEconomyIndex(p,economyIndex){return calculateSnackPrice(normalizeSnackProduct(p),economyIndex)}
function productPrice(p){return productPriceAtEconomyIndex(p,snackEconomyIndex())}
function productWholesalePrice(p){return calculateSnackWholesalePrice(normalizeSnackProduct(p),snackEconomyIndex())}
function publicPrice(p){return money(productPrice(p))}
function publicPriceAtEconomyIndex(p,economyIndex){return money(productPriceAtEconomyIndex(p,economyIndex))}
function productPriceAtIncome(p,income){
  if(!p) return 0;
  return productPriceAtEconomyIndex(p,income);
}
function publicPriceAtIncome(p,income){return publicPriceAtEconomyIndex(p,income)}
function ticketBaseAtIncome(k,income){return isTopDisplayTicket(k)?5:money(ticketBaseFromAverage(k,income))}
function ticketUnitAtIncome(k,income){return 0}
function ticketBuyAtIncome(k,income){
  return ticketBaseAtIncome(k,income);
}
function ticketSellAtIncome(k,income){
  return ticketBaseAtIncome(k,income);
}
function studentOptions(selected=""){return `<option value="">학생 선택</option>` + students().map(s=>`<option value="${s.id}" ${s.id===selected?"selected":""}>${s.name}${studentJobName(s)?` (${studentJobName(s)})`:""}</option>`).join("")}
function ticketOptions(){return Object.keys(ticketMeta).map(k=>`<option value="${k}">${ticketMeta[k].name}</option>`).join("")}
function productOptions(){return arr(data.products).map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}
const MARKET_CATEGORIES = ["전체","자유거래","서비스","직업","티켓","농산물","광산물","화석연료","완제품","기존상품","장식품","기타물품"];
const INDUSTRY_ACTION_LABELS = {materialProduction:"재료 생산",productManufacturing:"완제품 제작"};
function industryRoles(){return Object.values(INDUSTRY_CATALOG.roles)}
function industryMaterials(){return Object.values(INDUSTRY_CATALOG.materials)}
function industryProducts(){return Object.values(INDUSTRY_CATALOG.products)}
function industryRole(id){return INDUSTRY_CATALOG.roles[id] || null}
function industryMaterial(id){return INDUSTRY_CATALOG.materials[id] || null}
function industryProduct(id){return INDUSTRY_CATALOG.products[id] || null}
function industryItem(id){return industryMaterial(id) || industryProduct(id) || null}
function industryRoleState(studentId){return obj(data.industryRoles)[studentId] || null}
function industryRoleName(studentId){const r=industryRoleState(studentId); return r ? (r.roleName || industryRole(r.role)?.name || r.role) : "미선택"}
function industryInventory(studentId){return obj(obj(data.industryInventories)[studentId])}
function industryQty(studentId,itemId){return n(industryInventory(studentId)[itemId])}
function industryActionState(studentId,date=today()){
  const daily=obj(obj(data.industryDailyActions)[date])[studentId];
  if(daily) return daily;
  const legacy=obj(data.industryActionLocks)[studentId];
  return legacy?.date===date ? legacy : null;
}
function industryActionBlocked(studentId,nextAction){
  const state=industryActionState(studentId);
  return !!(state && state.action && state.action!==nextAction);
}
function industryActionText(studentId){
  const state=industryActionState(studentId);
  if(!state?.action) return "오늘 선택한 활동: 아직 없음";
  const label=INDUSTRY_ACTION_LABELS[state.action] || state.action;
  const blocked=state.action==="materialProduction" ? "오늘은 완제품 제작을 할 수 없습니다." : "오늘은 재료 생산을 할 수 없습니다.";
  return `오늘 선택한 활동: ${label}<br><span class="small">${blocked}</span>`;
}
function industryRecipeText(productItem){
  return Object.entries(obj(productItem.materials)).map(([id,qty])=>`${industryMaterial(id)?.name||id} ${n(qty)}`).join(", ");
}
function industryMaterialCost(item){return money(item?.productionCost || 0)}
function industryProductBaseCost(item){
  const materialCost=Object.entries(obj(item.materials)).reduce((sum,[id,qty])=>sum+industryMaterialCost(industryMaterial(id))*n(qty),0);
  return money(materialCost+n(item.manufactureCost));
}
function industryCostHint(item){
  if(!item) return "";
  if(industryMaterial(item.id)) return `생산비: ${won(industryMaterialCost(item))}`;
  const p=industryProduct(item.id);
  if(!p) return "";
  return `기본 원가 참고: ${industryRecipeText(p)} + 제조비 ${won(p.manufactureCost)} = ${won(industryProductBaseCost(p))}`;
}
function marketCategoryOptions(selected="전체", includeAll=true){
  return MARKET_CATEGORIES.filter(c=>includeAll || c!=="전체").map(c=>`<option value="${c}" ${c===selected?"selected":""}>${c}</option>`).join("");
}
const ROOM_ORDER = [
  "wall_wood","floor_wood","window_01","poster_01","clock_01",
  "bed_01","sofa_01","desk_01","pc_01","chair_01","table_01",
  "bookshelf_01","rug_01","aquarium_01","lamp_01","plant_01","guitar_01"
];
function byCatalogOrder(a,b){
  const ao=Number.isFinite(Number(a.order)) ? Number(a.order) : 9999;
  const bo=Number.isFinite(Number(b.order)) ? Number(b.order) : 9999;
  return ao-bo || String(a.name||a.id).localeCompare(String(b.name||b.id),"ko");
}
function databaseAvatarItems(){
  const entries=catalogMap(obj(data.avatarItems));
  return Object.values(entries).filter(it=>it && it.type==="avatar" && it.src)
    .reduce((acc,it)=>{acc[it.id]=it; return acc;},{});
}
function isAvatarHidden(id){
  return obj(data.hiddenAvatars)[id]===true;
}
function avatarItemCatalog(includeHidden=false){
  const items={...STATIC_AVATARS,...CUSTOM_AVATARS,...databaseAvatarItems()};
  return Object.values(items).filter(it=>it.visible!==false && (includeHidden || !isAvatarHidden(it.id))).sort(byCatalogOrder);
}
function roomItemById(id){return obj(defaultData.roomItems)[id] || obj(data.roomItems)[id] || null}
function roomItemCatalog(){
  const items={...obj(data.roomItems),...obj(defaultData.roomItems)};
  return ROOM_ORDER.map(id=>items[id]).filter(it=>it && it.visible!==false);
}

function roomTemplateCatalog(){return Object.values(MINIROOM_TEMPLATES)}
function roomTemplateById(id){return MINIROOM_TEMPLATES[id] || null}
function ownedRoomTemplateCount(studentId,itemId){return n(obj(obj(data.roomTemplateCloset)[studentId])[itemId])}
function roomTemplateStateOf(studentId){return {selected:"",...obj(obj(data.roomTemplateState)[studentId])}}
function selectedRoomTemplate(studentId){
  const st=roomTemplateStateOf(studentId);
  return roomTemplateById(st.selected) || roomTemplateCatalog()[0] || null;
}
function roomTemplateThumb(item){
  return `<div class="roomTemplateThumb"><img src="${item.src}" alt="${item.name}"></div>`;
}
function miniRoomViewHtml(studentId){
  return `<div class="miniRoomStage">${roomPreviewHtml(studentId)}</div>`;
}
function roomTemplateCard(studentId,item){
  const owned=ownedRoomTemplateCount(studentId,item.id)>0;
  const equipped=roomTemplateStateOf(studentId).selected===item.id || (!roomTemplateStateOf(studentId).selected && item.id==="room_wood_study");
  const price=cosmeticPrice(item);
  return `<div class="itemCard">${roomTemplateThumb(item)}<h4>${item.name}</h4><div class="small"><span class="pill ${rarityPillClass(item.rarity)}">${cosmeticRarityLabel(item)}</span> <span class="pill">미니룸</span></div><div class="value" style="font-size:22px">${won(price)}</div><div class="itemButtons">${owned?`<button class="${equipped?'green':'blue'}" onclick="equipRoomTemplate('${studentId}','${item.id}')">${equipped?'적용중':'적용'}</button>`:`<button class="primary" onclick="buyRoomTemplate('${studentId}','${item.id}')">구매</button>`}</div></div>`;
}
function ownedAvatarCount(studentId,itemId){return n(obj(obj(data.avatarCloset)[studentId])[itemId])}
function ownedRoomCount(studentId,itemId){return n(obj(obj(data.roomCloset)[studentId])[itemId])}
function avatarStateOf(studentId){return {avatar:"avatar_01",...obj(obj(data.avatarState)[studentId])}}
function roomStateOf(studentId){return {wallpaper:"",floor:"",placed:{},...obj(obj(data.roomState)[studentId])}}
function studentGender(studentId){return obj(data.avatarProfile)[studentId]?.gender || "f"}
function roomWallStyle(itemId){
  return 'background:linear-gradient(180deg,#d8c79f,#d3c093,#ccb585)';
}
function roomFloorStyle(itemId){
  return 'background:repeating-linear-gradient(90deg,#a06f3f 0 24px,#b37d49 24px 48px)';
}




function avatarItemById(id){return databaseAvatarItems()[id] || STATIC_AVATARS[id] || CUSTOM_AVATARS[id] || null}
function isDatabaseAvatar(id){return !!databaseAvatarItems()[id]}
function avatarCreatorId(item){
  if(!item) return "";
  const id=obj(data.avatarCreators)[item.id] || item.creatorStudentId || item.creatorId || item.studentId || "";
  return student(id) ? id : "";
}
function avatarCreatorRate(){return clampNum(data.settings?.avatarCreatorRate ?? 0.1,0,1)}
function avatarCreatorPercent(){return Math.round(avatarCreatorRate()*100)}
function avatarCreatorRoyalty(price,item,buyerId=""){
  const creator=avatarCreatorId(item);
  if(!creator || creator===buyerId) return 0;
  return money(price*avatarCreatorRate());
}
const RESTORED_AVATAR_IMAGES = {
  custom_surisuri: RESTORED_AVATAR_DATA_URIS.custom_surisuri,
  custom_nyangnyangnyanyang: RESTORED_AVATAR_DATA_URIS.custom_nyangnyangnyanyang,
  custom_twokkwi: RESTORED_AVATAR_DATA_URIS.custom_twokkwi,
  custom_cheongchun: RESTORED_AVATAR_DATA_URIS.custom_cheongchun,
  custom_question: RESTORED_AVATAR_DATA_URIS.custom_question,
  custom_pworworo: RESTORED_AVATAR_DATA_URIS.custom_pworworo
};
const RESTORED_AVATAR_IMAGES_BY_NAME = {
  "수리수리주수리": RESTORED_AVATAR_DATA_URIS.custom_surisuri,
  "냥냥냐냥": RESTORED_AVATAR_DATA_URIS.custom_nyangnyangnyanyang,
  "퉈뀌": RESTORED_AVATAR_DATA_URIS.custom_twokkwi,
  "청춘뭐시기": RESTORED_AVATAR_DATA_URIS.custom_cheongchun,
  "?": RESTORED_AVATAR_DATA_URIS.custom_question,
  "풔뤄뤄": RESTORED_AVATAR_DATA_URIS.custom_pworworo
};
function avatarImageSrc(item){
  const name=String(item?.name || "").trim();
  return RESTORED_AVATAR_IMAGES[item?.id] || RESTORED_AVATAR_IMAGES_BY_NAME[name] || item?.src || "";
}
function avatarCreatorLineHtml(item){
  const creator=avatarCreatorId(item);
  if(!creator) return `<div class="small">제작자 미지정 · 판매 수익 ${avatarCreatorPercent()}%</div>`;
  return `<div class="small"><span class="pill green">제작자 ${studentName(creator)}</span> 판매 수익 ${avatarCreatorPercent()}%</div>`;
}
function selectedAvatarItem(studentId){
  const st=avatarStateOf(studentId);
  return avatarItemById(st.avatar) || STATIC_AVATARS.avatar_01;
}
function staticAvatarHtml(studentId, small=false){
  const it=selectedAvatarItem(studentId);
  const cls=small ? "staticAvatarImg small" : "staticAvatarImg";
  return `<img class="${cls}" src="${avatarImageSrc(it)}" alt="${it.name}">`;
}
function pixelAvatarSVG(studentId, mode='large'){
  return staticAvatarHtml(studentId, mode==='small');
}
function cleanAvatarSvg(studentId, small=false){
  return staticAvatarHtml(studentId, small);
}
function avatarPreviewHtml(studentId){
  return `<div class="staticAvatarStage">${staticAvatarHtml(studentId,false)}</div>`;
}
function itemThumb(item){
  if(item.type==="avatar"){
    return `<div class="staticAvatarThumb"><img src="${avatarImageSrc(item)}" alt="${item.name}"></div>`;
  }
  return `<img class="miniAssetThumb" src="${roomAssetSrc(item)}" alt="${item.name}">`;
}

function roomWallColor(st){
  return "#ead9b4";
}
function roomFloorColor(st){
  return "#d3a66d";
}
function roomBackdropSvg(st){
  return `<img class="roomBaseAsset roomBaseFloor" src="assets/room/floor_wood.png" alt="">
    <img class="roomBaseAsset roomBaseWallWindow" src="assets/room/wall_window.png" alt="">
    <img class="roomBaseAsset roomBaseWallDecor" src="assets/room/wall_decor.png" alt="">`;
}
function miniSvg(body, viewBox="0 0 120 90"){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}
function roomAssetSvg(item){
  const wood="#b9793c", dark="#4a2d19", light="#f5d59c";
  if(item.type==="wallpaper") return miniSvg(`<rect width="120" height="90" fill="${roomWallColor({wallpaper:item.id})}"/><path d="M0 26H120M0 56H120M22 0V90M62 0V90M102 0V90" stroke="#fff" stroke-width="3" opacity=".5"/><path d="M0 72H120" stroke="#fff7ed" stroke-width="12"/>`);
  if(item.type==="floor") return miniSvg(`<polygon points="10,25 60,5 110,25 60,82" fill="${roomFloorColor({floor:item.id})}" stroke="${dark}" stroke-width="6"/><path d="M22 32H98M34 46H86M46 60H74" stroke="#fff" stroke-width="3" opacity=".35"/>`);
  if(item.id==="bed_01" || item.type==="blanket") return miniSvg(`<polygon points="12,38 64,20 108,38 56,62" fill="${wood}" stroke="${dark}" stroke-width="5"/><polygon points="22,34 54,24 84,36 52,48" fill="#e0f2fe" stroke="#2563eb" stroke-width="4"/><polygon points="15,48 56,62 56,78 15,62" fill="#8b5a2b" stroke="${dark}" stroke-width="5"/><polygon points="56,62 108,38 108,54 56,78" fill="#a86a32" stroke="${dark}" stroke-width="5"/><polygon points="34,28 52,22 66,28 48,35" fill="#fff7ed"/>`);
  if(item.id==="sofa_01") return miniSvg(`<polygon points="12,46 54,28 104,46 62,68" fill="#f5e6c8" stroke="${dark}" stroke-width="5"/><path d="M16 45V64L62 82V66zM62 66l42-20v18L62 82z" fill="#8b5a2b" stroke="${dark}" stroke-width="5"/><polygon points="36,38 55,31 73,39 54,47" fill="#fff7ed" stroke="${dark}" stroke-width="3"/>`);
  if(item.id==="desk_01") return miniSvg(`<polygon points="18,34 62,18 106,34 62,52" fill="${light}" stroke="${dark}" stroke-width="5"/><path d="M26 46V70M96 42V66M50 52V76" stroke="${dark}" stroke-width="6"/><path d="M28 48H92" stroke="#8b5a2b" stroke-width="7"/>`);
  if(item.id==="pc_01") return miniSvg(`<rect x="35" y="12" width="46" height="32" rx="4" fill="#1f2937" stroke="${dark}" stroke-width="5"/><rect x="42" y="19" width="32" height="17" fill="#93c5fd"/><path d="M58 44v10" stroke="${dark}" stroke-width="6"/><polygon points="28,59 62,49 96,59 62,72" fill="#e5e7eb" stroke="${dark}" stroke-width="4"/><ellipse cx="86" cy="66" rx="8" ry="4" fill="#cbd5e1" stroke="${dark}" stroke-width="3"/>`);
  if(item.id==="chair_01") return miniSvg(`<polygon points="32,42 62,30 88,42 58,56" fill="#475569" stroke="${dark}" stroke-width="5"/><path d="M40 35V20h35v22M43 55v23M76 50v24" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>`);
  if(item.id==="table_01") return miniSvg(`<polygon points="18,36 62,18 106,36 62,58" fill="${light}" stroke="${dark}" stroke-width="5"/><path d="M34 50v22M88 44v22M58 58v24" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>`);
  if(item.id==="bookshelf_01") return miniSvg(`<polygon points="24,25 78,10 96,22 42,40" fill="${wood}" stroke="${dark}" stroke-width="5"/><path d="M42 40v36L96 56V22" fill="#a86a32" stroke="${dark}" stroke-width="5"/><path d="M50 47l38-14M50 61l38-14" stroke="#f5d59c" stroke-width="4"/><path d="M55 43v12M68 39v13M80 35v13" stroke="#60a5fa" stroke-width="5"/>`);
  if(item.id==="rug_01") return miniSvg(`<ellipse cx="60" cy="48" rx="48" ry="24" fill="#fde68a" stroke="${dark}" stroke-width="5"/><ellipse cx="60" cy="48" rx="34" ry="15" fill="#fef3c7" stroke="#f59e0b" stroke-width="3" opacity=".9"/>`);
  if(item.type==="plant") return miniSvg(`<ellipse cx="60" cy="66" rx="22" ry="10" fill="#7c2d12" stroke="${dark}" stroke-width="4"/><path d="M42 61h36l-7 22H49z" fill="#b45309" stroke="${dark}" stroke-width="4"/><path d="M60 61C36 48 42 25 60 41C62 20 85 24 67 61C54 28 33 36 49 62" fill="#22c55e" stroke="#166534" stroke-width="4"/>`);
  if(item.id==="lamp_01") return miniSvg(`<path d="M60 30v42" stroke="${dark}" stroke-width="6"/><ellipse cx="60" cy="75" rx="18" ry="7" fill="${wood}" stroke="${dark}" stroke-width="4"/><path d="M42 34h36l-8-22H50z" fill="#fde68a" stroke="${dark}" stroke-width="4"/><circle cx="60" cy="36" r="20" fill="#facc15" opacity=".24"/>`);
  if(item.id==="poster_01") return miniSvg(`<rect x="18" y="12" width="84" height="62" rx="5" fill="#fff7ed" stroke="${dark}" stroke-width="6"/><path d="M28 63l22-24 13 13 18-25 13 36z" fill="#93c5fd"/><circle cx="39" cy="30" r="7" fill="#f59e0b"/>`);
  if(item.id==="clock_01") return miniSvg(`<circle cx="60" cy="45" r="31" fill="#fff7ed" stroke="${dark}" stroke-width="6"/><path d="M60 45V25M60 45l16 10" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`);
  if(item.type==="window") return miniSvg(`<rect x="18" y="12" width="84" height="62" rx="4" fill="#dbeafe" stroke="${dark}" stroke-width="6"/><path d="M60 14v59-teacher-accessM20 43h80" stroke="#fff" stroke-width="5"/><path d="M26 62l18-20 10 11 18-24 22 33" fill="#93c5fd" opacity=".75"/>`);
  return miniSvg(`<polygon points="20,44 60,22 100,44 60,68" fill="${wood}" stroke="${dark}" stroke-width="5"/>`);
}
function roomAssetDataUri(item){return `data:image/svg+xml,${encodeURIComponent(roomAssetSvg(item))}`}
function roomAssetSrc(item){return item.src || item.asset || item.thumb || roomAssetDataUri(item)}
function roomAssetSize(item){
  const placed=roomItemPlacement(item);
  if(placed) return [placed.w, placed.h];
  if(item.type==="wallpaper"||item.type==="floor") return [92,70];
  if(item.id==="bed_01") return [124,88];
  if(item.id==="sofa_01") return [128,94];
  if(item.id==="desk_01"||item.id==="pc_01") return [116,86];
  if(item.id==="bookshelf_01") return [98,110];
  if(item.id==="rug_01") return [150,92];
  if(item.type==="plant") return [58,78];
  if(item.id==="table_01") return [112,84];
  if(item.id==="chair_01") return [74,82];
  return [82,72];
}
function roomItemPlacement(item){
  const map={
    window_01:{x:144,y:102,w:94,h:66,z:24},
    window_round:{x:386,y:96,w:74,h:74,z:24},
    curtain_01:{x:126,y:94,w:126,h:90,z:25},
    curtain_02:{x:126,y:94,w:126,h:90,z:25},
    door_01:{x:414,y:105,w:70,h:120,z:26},
    door_02:{x:414,y:105,w:78,h:126,z:26},
    poster_01:{x:386,y:104,w:62,h:50,z:25},
    clock_01:{x:340,y:78,w:52,h:52,z:26},
    bed_01:{x:156,y:248,w:118,h:82,z:138},
    bookshelf_01:{x:228,y:162,w:92,h:98,z:104},
    lamp_01:{x:330,y:162,w:54,h:88,z:118},
    plant_01:{x:250,y:180,w:52,h:72,z:116},
    sofa_01:{x:356,y:226,w:120,h:88,z:182},
    desk_01:{x:142,y:274,w:112,h:82,z:220},
    pc_01:{x:160,y:238,w:68,h:58,z:232},
    chair_01:{x:220,y:306,w:64,h:72,z:262},
    rug_01:{x:220,y:286,w:156,h:86,z:202},
    table_01:{x:286,y:308,w:104,h:76,z:278},
    aquarium_01:{x:326,y:226,w:78,h:64,z:210},
    wardrobe_01:{x:390,y:168,w:94,h:106,z:112},
  };
  const preset=map[item.id] || null;
  const custom=obj(item.placement);
  const hasCustom=["x","y","w","h","z"].some(k=>Object.prototype.hasOwnProperty.call(item,k));
  if(preset && (Object.keys(custom).length || hasCustom)){
    return {
      ...preset,
      ...custom,
      ...(hasCustom ? {
        x:Object.prototype.hasOwnProperty.call(item,"x") ? n(item.x) : preset.x,
        y:Object.prototype.hasOwnProperty.call(item,"y") ? n(item.y) : preset.y,
        w:Object.prototype.hasOwnProperty.call(item,"w") ? n(item.w) : preset.w,
        h:Object.prototype.hasOwnProperty.call(item,"h") ? n(item.h) : preset.h,
        z:Object.prototype.hasOwnProperty.call(item,"z") ? n(item.z) : preset.z
      } : {})
    };
  }
  if(preset) return preset;
  if(Object.keys(custom).length){
    const [fallbackW,fallbackH]=roomAssetSize({...item,placement:null});
    return {x:n(custom.x),y:n(custom.y),w:n(custom.w)||fallbackW,h:n(custom.h)||fallbackH,z:n(custom.z)||60+n(custom.y)};
  }
  if(hasCustom){
    const [fallbackW,fallbackH]=roomAssetSize({...item,x:undefined,y:undefined,w:undefined,h:undefined,z:undefined});
    return {x:n(item.x),y:n(item.y),w:n(item.w)||fallbackW,h:n(item.h)||fallbackH,z:n(item.z)||60+n(item.y)};
  }
  return null;
}
function roomItemDepth(item){
  const placed=roomItemPlacement(item);
  if(placed) return placed.z;
  if(["window","decor"].includes(item.type) || item.id==="clock_01" || item.id==="poster_01") return 20;
  if(item.id==="lamp_01") return 46;
  if(item.type==="rug") return 35;
  return 60+n(item.y);
}
function roomItemLayer(item){
  const [w,h]=roomAssetSize(item);
  const placed=roomItemPlacement(item);
  const left=placed ? placed.x : n(item.x);
  const top=placed ? placed.y : n(item.y);
  return `<img class="roomAsset" src="${roomAssetSrc(item)}" alt="${item.name}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${roomItemDepth(item)}">`;
}
function roomPreviewHtml(studentId){
  const st=roomStateOf(studentId);
  const viewState={...st,wallpaper:st.wallpaper||"wall_wood",floor:st.floor||"floor_wood"};
  const placed=obj(st.placed);
  const layers=roomItemCatalog()
    .filter(it=>placed[it.id] && !["wallpaper","floor"].includes(it.type))
    .sort((a,b)=>roomItemDepth(a)-roomItemDepth(b))
    .map(roomItemLayer).join("");
  return `<div class="cleanRoom">
    <div class="cleanRoomName">${studentName(studentId)}의 방</div>
    <div class="miniRoomCanvas">
      ${roomBackdropSvg(viewState)}
      ${layers}
      ${cleanAvatarSvg(studentId,true)}
    </div>
  </div>`;
}
function equippedAvatarItem(studentId,itemId){const st=avatarStateOf(studentId); return st.avatar===itemId;}
function roomItemPlaced(studentId,itemId){const st=roomStateOf(studentId); return !!obj(st.placed)[itemId]}
function rarityPillClass(r){return r==='전설'?'orange':r==='에픽'?'purple':r==='희귀'?'blue':'green'}
function avatarItemCard(studentId,item){
  const owned=ownedAvatarCount(studentId,item.id)>0, equipped=equippedAvatarItem(studentId,item.id);
  const price=cosmeticPrice(item);
  return `<div class="itemCard avatarShopCard ${owned?'ownedAvatar':''} ${equipped?'equippedAvatar':''}"><div class="shopThumb clickableThumb" onclick="showAvatarPreviewLarge('${item.id}')">${itemThumb(item)}</div><h4 onclick="showAvatarPreviewLarge('${item.id}')">${item.name}</h4><div class="small"><span class="pill ${rarityPillClass(item.rarity)}">${cosmeticRarityLabel(item)}</span> <span class="pill">${owned?"보유중":"상점"}</span>${equipped?` <span class="pill green">적용중</span>`:""}</div>${avatarCreatorLineHtml(item)}<div class="value" style="font-size:22px">${won(price)}</div><div class="itemButtons"><button class="compactBtn" onclick="showAvatarPreviewLarge('${item.id}')">미리보기</button>${owned?`<button class="${equipped?'green':'blue'}" onclick="equipAvatarItem('${studentId}','${item.id}')">${equipped?'적용중':'적용'}</button>`:`<button class="primary" onclick="buyAvatarItem('${studentId}','${item.id}')">구매</button>`}</div></div>`;
}
function roomItemCard(studentId,item){
  const owned=ownedRoomCount(studentId,item.id)>0, placed=roomItemPlaced(studentId,item.id), st=roomStateOf(studentId);
  const active=item.type==='wallpaper' ? st.wallpaper===item.id : item.type==='floor' ? st.floor===item.id : placed;
  const surface = item.type==='wallpaper' || item.type==='floor';
  const action = surface ? (active?'적용중':'적용') : (active?'해제':'배치');
  const price=cosmeticPrice(item);
  return `<div class="itemCard"><div class="shopThumb">${itemThumb(item)}</div><h4>${item.name}</h4><div class="small"><span class="pill ${rarityPillClass(item.rarity)}">${cosmeticRarityLabel(item)}</span> <span class="pill">${item.type}</span></div><div class="value" style="font-size:22px">${won(price)}</div><div class="itemButtons">${owned?`<button class="${active?'green':'blue'}" onclick="toggleRoomItem('${studentId}','${item.id}')">${action}</button>`:`<button class="primary" onclick="buyRoomItem('${studentId}','${item.id}')">구매</button>`}</div></div>`;
}

function equippedName(studentId,type){
  const st=avatarStateOf(studentId); const it=obj(data.avatarItems)[st[type]]; return it?`${it.icon||'■'} ${it.name}`:'없음';
}
function avatarDetailHtml(studentId){
  const it=selectedAvatarItem(studentId);
  return `<div class="section"><div class="head"><div><h2>아바타 상세보기</h2><div class="sub">완성형 도트 캐릭터를 선택하는 방식입니다.</div></div></div>
    <div class="avatarDetail">
      <div class="avatarDetailStage">${staticAvatarHtml(studentId,false)}</div>
      <div>
        <div class="equipGrid"><div class="equipSlot"><b>선택 아바타</b><br><span class="small">${it.icon||'🧍'} ${it.name}</span></div></div>
        <div class="sub" style="margin-top:12px">아바타 상점에서 구매한 뒤 장착할 수 있습니다. 등급에 따라 가격이 다릅니다.</div>
      </div>
    </div></div>`;
}
function miniRoomGalleryHtml(studentId=selectedStudent){
  return `<div class="section">
    <div class="head"><div><h2>내 미니룸</h2><div class="sub">가구와 벽지, 바닥을 구매한 뒤 배치하거나 적용합니다.</div></div><div>${currentAssetPill(studentId)}</div></div>
    ${miniRoomViewHtml(studentId)}
    <div class="mutedBox" style="margin-top:12px"><b>보유 인테리어</b><br><span class="small">${roomOwnedSummary(studentId)}</span></div>
  </div>
  <div class="section">
    <div class="head"><div><h2>미니룸 상점</h2><div class="sub">저용량 SVG 가구라 빠르게 열리고, 배치 상태는 자동 저장됩니다.</div></div></div>
    <div class="storeCards">${roomItemCatalog().map(it=>roomItemCard(studentId,it)).join("")}</div>
  </div>`;
}
function avatarOwnedSummary(studentId){
  return avatarItemCatalog().filter(it=>ownedAvatarCount(studentId,it.id)>0).map(it=>it.icon+' '+it.name).join(' / ') || '없음';
}
function roomOwnedSummary(studentId){
  return roomItemCatalog().filter(it=>ownedRoomCount(studentId,it.id)>0).map(it=>it.icon+' '+it.name).join(' / ') || '없음';
}


function cosmeticPrice(item){
  if(!item) return 0;
  const prices=obj(data.cosmeticPrices);
  return Object.prototype.hasOwnProperty.call(prices,item.id) ? money(prices[item.id]) : money(item.price ?? 500);
}
function allCosmeticItems(){return [...avatarItemCatalog(),...roomItemCatalog(),...roomTemplateCatalog()]}
function cosmeticRarityLabel(item){ return item?.rarity || "일반"; }
function assetUrl(key){ return PIXEL_ASSETS[key] || ''; }

function materialIcon(name, extraClass=""){
  return `<span class="material-symbols-rounded ${extraClass}" aria-hidden="true">${name}</span>`;
}
function renderNavIcon(icon){
  if(!icon) return `<span class="tabIcon">•</span>`;
  return /^[a-z0-9_]+$/i.test(icon) ? materialIcon(icon,"tabIcon msIcon") : `<span class="tabIcon">${icon}</span>`;
}
function renderMenuCardIcon(icon){
  if(!icon) return `<span>•</span>`;
  return /^[a-z0-9_]+$/i.test(icon) ? materialIcon(icon,"menuCardIcon msIcon") : `<span>${icon}</span>`;
}
function metaPill(icon,text){
  return `<span>${materialIcon(icon,'metaIcon msIcon')}${text}</span>`;
}
function infoCardIcon(icon){
  return `<i class="mobileInfoIconV109">${materialIcon(icon,'msIcon')}</i>`;
}

function studentNavItems(){
  if(isMobileViewport()){
    return [
      ["dashboard","홈","home"],
      ["finance","통장","account_balance"],
      ["market","시장","shopping_cart"],
      ["noticeboard","알림","notifications"],
      ["more","메뉴","menu"]
    ].filter(([id])=>id==="dashboard" || studentTabVisible(id));
  }
  const available=studentTabCatalog().filter(tab=>{
    if(tab.dynamic==="workClaims") return selectedStudent && pieceRateJobsForStudent(selectedStudent).length;
    if(tab.dynamic==="corporations") return selectedStudent && isCorporationAssignedStudent(selectedStudent);
    if(tab.dynamic==="role") return selectedStudent && specialRoleIdsForStudent(selectedStudent).length;
    return true;
  });
  return available.filter(tab=>studentTabVisible(tab.id)).map(tab=>[tab.id,tab.name,tab.icon]);
}
function studentTabCatalog(){
  return [
    {id:"dashboard",name:"대시보드·재산",icon:"⌂",note:"학생 기본 화면"},
    {id:"noticeboard",name:"알림장",icon:"▣",note:"숙제·준비물·공지와 선생님 메시지"},
    {id:"market",name:"시장",icon:"▦",note:"학생 간 판매글"},
    {id:"products",name:"상점·티켓",icon:"▣",note:"상품·티켓 구매"},
    {id:"finance",name:"은행",icon:"🏦",note:"예금·적금·채권·대출"},
    {id:"industry",name:"생산·제작",icon:"⚙",note:"생산과 제작"},
    {id:"workClaims",name:"직업 업무",icon:"◇",note:"성과급 직업 학생에게만 표시",dynamic:"workClaims"},
    {id:"corporations",name:"법인업무",icon:"▥",note:"법인 계정 학생에게만 표시",dynamic:"corporations"},
    {id:"role",name:"직업업무",icon:"⚖",note:"특수 직업 학생에게만 표시",dynamic:"role"},
    {id:"visit",name:"구경하기",icon:"◎",note:"친구 정보와 순위"},
    {id:"cosmetic",name:"아바타",icon:"♙",note:"아바타 상점과 보유 현황"},
    {id:"room",name:"미니룸",icon:"▤",note:"미니룸 꾸미기"},
    {id:"settings",name:"설정",icon:"⚙",note:"학생 신청·거래내역"}
  ];
}
function studentTabVisible(id){
  if(id==="dashboard") return true;
  return obj(data.settings?.hiddenStudentTabs)[id]!==true;
}
function isMobileViewport(){return window.matchMedia?.("(max-width: 768px)")?.matches || window.innerWidth<=768}
window.addEventListener("resize",()=>scheduleRender(120));
function studentNavBadgeCount(id){
  if(id!=="noticeboard" || !selectedStudent) return 0;
  const stats=studentNoticeStats(selectedStudent);
  return n(stats.todayCount)+n(stats.uncheckedHomework)+n(stats.unreadMessages);
}
function studentTabsHtml(active){
  const tabs=studentNavItems();
  return `<div class="studentTabs topTabs">${tabs.map(([id,name,icon])=>{
    const badge=studentNavBadgeCount(id);
    return `<button class="${active===id?'active':''}" onclick="setStudentTab('${id}')">${renderNavIcon(icon)}<span class="tabLabel">${name}</span>${badge>0?`<span class="navBadge">${badge>99?"99+":badge}</span>`:""}</button>`;
  }).join('')}</div>`;
}
function mobileMenuGrid(cards){
  return `<div class="mobileMenuGrid">${cards.map(c=>`<button class="mobileMenuCard" onclick="${c.onClick||`openMobilePage('${c.id}')`}">${renderMenuCardIcon(c.icon)}<b>${c.title}</b><small>${c.description||""}</small>${c.badge?`<em>${c.badge}</em>`:""}</button>`).join("")}</div>`;
}
function mobileSubPageHeader(title,back="backMobilePage()"){
  return `<div class="mobileSubHeader"><button onclick="${back}">‹ 뒤로</button><h2>${title}</h2></div>`;
}
function mobileStudentHomeButtonHtml(label="홈"){
  return `<button class="mobileHomeReturnBtn" onclick="goStudentHome()">${materialIcon("home","msIcon")} ${label}</button>`;
}
function mobileNoticeSubHeader(title){
  return `<div class="mobileSubHeader mobileNoticeSubHeader"><button onclick="backMobilePage()">‹ 뒤로</button><h2>${title}</h2>${mobileStudentHomeButtonHtml("홈")}</div>`;
}
window.goStudentHome = function(){
  studentTab="dashboard";
  activeMobilePage="";
  localStorage.setItem("studentTab",studentTab);
  localStorage.removeItem("activeMobilePage");
  render();
}
window.openMobilePage = function(id){activeMobilePage=id; localStorage.setItem("activeMobilePage",id); render();}
window.openStudentMobileTarget = function(tab,page=""){
  studentTab=tab;
  activeMobilePage=page || "";
  localStorage.setItem("studentTab",tab);
  if(activeMobilePage) localStorage.setItem("activeMobilePage",activeMobilePage);
  else localStorage.removeItem("activeMobilePage");
  render();
}
window.backMobilePage = function(){activeMobilePage=""; localStorage.removeItem("activeMobilePage"); render();}
window.openMobileTeacherPage = function(id){activeMobileTeacherPage=id; localStorage.setItem("activeMobileTeacherPage",id); render();}
window.backMobileTeacherPage = function(){activeMobileTeacherPage=""; localStorage.removeItem("activeMobileTeacherPage"); render();}

const NOTICE_TYPES=[
  {id:"notice",name:"공지",check:false},
  {id:"homework",name:"숙제",check:true,action:"했어요"},
  {id:"material",name:"준비물",check:true,action:"확인했어요"},
  {id:"event",name:"행사",check:false}
];
const TEACHER_ID="teacher";
function noticeTypeInfo(type){return NOTICE_TYPES.find(t=>t.id===type) || NOTICE_TYPES[0]}
function isTeacherMode(){return mode==="teacher" && teacherUnlocked}
function hasTeacherAccess(){
  if(teacherUnlocked) return true;
  if(sessionStorage.getItem("teacherUnlocked")==="true"){
    teacherUnlocked=true;
    return true;
  }
  return false;
}
function requireTeacherAccess(){
  if(hasTeacherAccess()) return true;
  toast("교사 권한이 필요합니다.");
  showTeacherLogin?.();
  return false;
}
function noticeDateValue(v){
  if(!v) return "";
  if(typeof v==="string") return v.slice(0,10);
  if(v.toDate) return localDateString(v.toDate());
  return localDateString(v);
}
function noticeTsText(v){
  if(!v) return "-";
  const d=v.toDate ? v.toDate() : new Date(v);
  return seoulDateTimeText(d.toISOString());
}
function noticeTsDetailText(v){
  if(!v) return "-";
  const d=v.toDate ? v.toDate() : new Date(v);
  if(Number.isNaN(d.getTime())) return "-";
  const day=d.toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",weekday:"short"});
  const date=d.toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit"}).replace(/\.\s?/g,".").replace(/\.$/,"");
  const time=d.toLocaleTimeString("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"});
  return `${date} (${day}) ${time}`;
}
function noticeCheckItems(nc){return arr(nc.checkItems).map(x=>String(x||"").trim()).filter(Boolean)}
function noticeCheckItemsHtml(nc){
  const items=noticeCheckItems(nc);
  if(!items.length) return "";
  return `<div class="noticeItemList">${items.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`;
}
function noticeTargetsNotice(nc){
  if((nc.targetType||"all")==="all") return students().map(s=>s.id);
  return arr(nc.targetStudentIds).filter(id=>student(id));
}
function noticeAppliesToStudent(nc,studentId){
  if(!nc || nc.deleted) return false;
  if((nc.targetType||"all")==="all") return true;
  return arr(nc.targetStudentIds).includes(studentId);
}
function sortedNotices(rows){
  return [...rows].filter(n=>!n.deleted).sort((a,b)=>{
    const da=noticeDateValue(a.dueDate)||"9999-12-31";
    const db=noticeDateValue(b.dueDate)||"9999-12-31";
    return da.localeCompare(db) || noticeTimeNumber(b.createdAt)-noticeTimeNumber(a.createdAt);
  });
}
function statusDocId(noticeId,studentId){return `${noticeId}_${studentId}`.replace(/[^a-zA-Z0-9_-]/g,"_")}
function statusForNoticeStudent(noticeId,studentId){
  return obj(noticeState.studentStatuses)[statusDocId(noticeId,studentId)] || noticeState.statuses.find(s=>s.noticeId===noticeId && s.studentId===studentId) || null;
}
function noticeUnreadForStudent(id){return n(noticeState.studentRoom?.unreadByStudent)}
function teacherUnreadMessages(){return noticeState.rooms.reduce((sum,r)=>sum+n(r.unreadByTeacher),0)}
function todayUncheckedNoticeCount(){
  return sortedNotices(noticeState.all)
    .filter(nc=>["homework","material"].includes(nc.type) && (!noticeDateValue(nc.dueDate) || noticeDateValue(nc.dueDate)>=today()))
    .reduce((sum,nc)=>sum+teacherCheckStats(nc).unchecked.length,0);
}
function studentNoticeStats(id){
  const rows=sortedNotices(noticeState.student);
  const todayRows=rows.filter(nc=>!noticeDateValue(nc.dueDate) || noticeDateValue(nc.dueDate)>=today());
  const homework=rows.filter(nc=>nc.type==="homework");
  const unchecked=homework.filter(nc=>!statusForNoticeStudent(nc.id,id)?.checked);
  return {todayCount:todayRows.length,homeworkCount:homework.length,uncheckedHomework:unchecked.length,unreadMessages:noticeUnreadForStudent(id)};
}
function clearUnsubs(list){list.splice(0).forEach(fn=>{try{fn();}catch(_){}})}
function noticeRecordList(key){
  return Object.entries(obj(data[key])).map(([id,value])=>({id,...obj(value)}));
}
function noticeTimeNumber(v){
  if(!v) return 0;
  if(typeof v==="number") return v;
  if(v?.seconds) return v.seconds*1000;
  const d=new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
function syncNoticeStateFromRealtimeData(){
  const notices=sortedNotices(noticeRecordList("classroomNotices"));
  const statuses=noticeRecordList("classroomNoticeStatus");
  const rooms=noticeRecordList("teacherMessageRooms")
    .filter(r=>!r.closed)
    .sort((a,b)=>noticeTimeNumber(b.updatedAt||b.lastMessageAt)-noticeTimeNumber(a.updatedAt||a.lastMessageAt));
  noticeState.all=notices;
  noticeState.teacherStatuses=statuses;
  noticeState.rooms=rooms;
  if(selectedTeacherMessageRoom && !rooms.some(r=>r.id===selectedTeacherMessageRoom)){
    selectedTeacherMessageRoom="";
    localStorage.removeItem("teacherMessageRoom");
  }
  if(selectedStudent){
    noticeState.student=sortedNotices(notices.filter(nc=>noticeAppliesToStudent(nc,selectedStudent)));
    noticeState.statuses=statuses.filter(s=>s.studentId===selectedStudent);
    noticeState.studentStatuses=noticeState.statuses.reduce((o,s)=>{o[s.id]=s; return o;},{});
    const roomId=`room_${selectedStudent}`;
    const room=obj(data.teacherMessageRooms)[roomId];
    noticeState.studentRoom=room?{id:roomId,...obj(room)}:null;
  }else{
    noticeState.student=[];
    noticeState.statuses=[];
    noticeState.studentStatuses={};
    noticeState.studentRoom=null;
  }
  const activeRoomId = mode==="teacher"
    ? selectedTeacherMessageRoom
    : (mode==="student" && selectedStudent && (selectedNoticeStudentTab==="message" || studentTab==="noticeboard") ? `room_${selectedStudent}` : "");
  noticeState.messages = activeRoomId
    ? noticeRecordList("teacherMessages")
        .filter(m=>m.roomId===activeRoomId && !m.deleted)
        .sort((a,b)=>noticeTimeNumber(a.createdAt)-noticeTimeNumber(b.createdAt))
    : [];
}
function setNoticeSnapshot(listName,snap,mapFn){
  noticeState[listName]=snap.docs.map(d=>({id:d.id,...mapFn(d.data())}));
  scheduleRender();
}
function subscribeStudentNoticeData(studentId){syncNoticeStateFromRealtimeData();}
function subscribeTeacherNoticeData(){syncNoticeStateFromRealtimeData();}
function subscribeMessagesForRoom(roomId){syncNoticeStateFromRealtimeData();}
function ensureNoticeSubscriptions(){syncNoticeStateFromRealtimeData();}
function noticeTabsHtml(active,teacher=false){
  const tabs=teacher
    ? [["create","알림 등록"],["list","알림 목록"],["checks","체크 현황"],["messages",`학생 메시지함${teacherUnreadMessages()?` (${teacherUnreadMessages()})`:""}`]]
    : [["today","오늘"],["homework","숙제"],["material","준비물"],["events","행사/공지"],["message",`선생님께 메시지${noticeUnreadForStudent(selectedStudent)?` (${noticeUnreadForStudent(selectedStudent)})`:""}`]];
  return `<div class="studentTabs topTabs">${tabs.map(([id,name])=>`<button class="${active===id?'active':''}" onclick="${teacher?`setTeacherNoticeTab('${id}')`:`setStudentNoticeTab('${id}')`}">${name}</button>`).join("")}</div>`;
}
function noticeStatusPill(nc,studentId){
  const st=statusForNoticeStudent(nc.id,studentId);
  if(st?.teacherConfirmed) return `<span class="pill green">선생님 확인 완료</span>`;
  if(st?.checked) return `<span class="pill blue">체크 완료 · 선생님 확인 전</span>`;
  const due=noticeDateValue(nc.dueDate);
  if(due && due<today()) return `<span class="pill red">마감 지남</span>`;
  return `<span class="pill orange">미체크</span>`;
}
function noticeCardHtml(nc,studentId){
  const info=noticeTypeInfo(nc.type);
  const due=noticeDateValue(nc.dueDate);
  const st=statusForNoticeStudent(nc.id,studentId);
  const canCheck=info.check;
  return `<div class="card noticeCard ${nc.important?'important':''}">
    <div class="head"><div><h3>${nc.important?"★ ":""}${escapeHtml(nc.title||"제목 없음")}</h3><div class="sub">${info.name}${due?` · ${due}`:""}</div></div>${noticeStatusPill(nc,studentId)}</div>
    <p>${escapeHtml(nc.content||"").replace(/\n/g,"<br>")}</p>
    ${noticeCheckItemsHtml(nc)}
    ${canCheck?`<div class="toolbar"><button class="green" onclick="checkNotice('${nc.id}','${studentId}')" ${st?.teacherConfirmed?"disabled":""}>${st?.checked?"다시 체크":(info.action||"체크")}</button></div>`:""}
  </div>`;
}
function studentNoticeListHtml(type,id){
  let rows=sortedNotices(noticeState.student);
  if(type==="today") rows=rows.filter(nc=>!noticeDateValue(nc.dueDate) || noticeDateValue(nc.dueDate)>=today()).slice(0,30);
  if(type==="homework") rows=rows.filter(nc=>nc.type==="homework");
  if(type==="material") rows=rows.filter(nc=>nc.type==="material");
  if(type==="events") rows=rows.filter(nc=>["notice","event"].includes(nc.type));
  if(!rows.length) return `<p class="small">표시할 알림이 없습니다.</p>`;
  return `<div class="grid g2 noticeGrid">${rows.map(nc=>noticeCardHtml(nc,id)).join("")}</div>`;
}
function noticeboardStudentHtml(id){
  if(isMobileViewport()) return mobileNoticeboardStudentHtml(id);
  const stats=studentNoticeStats(id);
  const listPanel = selectedNoticeStudentTab==="message"
    ? studentTeacherMessageHtml(id)
    : `<div class="section noticeListPanel">${studentNoticeListHtml(selectedNoticeStudentTab,id)}</div>`;
  const messageAside = selectedNoticeStudentTab==="message"
    ? ""
    : `<aside class="noticeMessageAside">${studentTeacherMessageHtml(id)}</aside>`;
  return `<div class="noticeboardPage">
    <div class="section"><div class="head"><div><h2>알림장</h2><div class="sub">숙제, 준비물, 행사, 공지를 확인하고 선생님께 메시지를 보냅니다.</div></div><span class="pill blue">읽지 않은 답장 ${stats.unreadMessages}</span></div>
      <div class="grid g3"><div class="stat blue"><div class="label">오늘/다가오는 알림</div><div class="value">${stats.todayCount}개</div></div><div class="stat orange"><div class="label">숙제</div><div class="value">${stats.homeworkCount}개</div></div><div class="stat red"><div class="label">미체크 숙제</div><div class="value">${stats.uncheckedHomework}개</div></div></div>
      ${noticeTabsHtml(selectedNoticeStudentTab,false)}
    </div>
    <div class="noticeboardMain">${listPanel}${messageAside}</div>
  </div>`;
}
function studentNoticeSummaryHtml(id){
  const stats=studentNoticeStats(id);
  if(!studentTabVisible("noticeboard")) return "";
  return `<div class="section"><div class="head"><div><h2>알림장 요약</h2><div class="sub">오늘 확인할 알림과 선생님 답장입니다.</div></div><button onclick="setStudentTab('noticeboard')">알림장 열기</button></div><div class="grid g3"><div class="stat blue"><div class="label">오늘 알림</div><div class="value">${stats.todayCount}개</div></div><div class="stat orange"><div class="label">미체크 숙제</div><div class="value">${stats.uncheckedHomework}개</div></div><div class="stat red"><div class="label">읽지 않은 답장</div><div class="value">${stats.unreadMessages}개</div></div></div></div>`;
}
function mobileNoticeboardStudentHtml(id){
  if(activeMobilePage){
    const map={today:"오늘의 할 일",homework:"숙제",material:"준비물",events:"행사/공지",message:"선생님께 메시지"};
    selectedNoticeStudentTab=activeMobilePage;
    return `${mobileNoticeSubHeader(map[activeMobilePage]||"알림장")}${activeMobilePage==="message"?studentTeacherMessageHtml(id):`<div class="section">${studentNoticeListHtml(activeMobilePage,id)}</div>`}`;
  }
  const stats=studentNoticeStats(id);
  const materialUnchecked=sortedNotices(noticeState.student).filter(nc=>nc.type==="material"&&!statusForNoticeStudent(nc.id,id)?.checked).length;
  const eventCount=sortedNotices(noticeState.student).filter(nc=>["notice","event"].includes(nc.type)&&(!noticeDateValue(nc.dueDate)||noticeDateValue(nc.dueDate)>=today())).length;
  return `<div class="section"><div class="head"><div><h2>알림장</h2><div class="sub">필요한 항목만 눌러 확인하세요.</div></div>${mobileStudentHomeButtonHtml("홈으로")}</div>${mobileMenuGrid([
    {id:"today",icon:"☑",title:"오늘의 할 일",description:"오늘과 다가오는 숙제·준비물",badge:`${stats.todayCount}개`},
    {id:"homework",icon:"✎",title:"숙제",description:"미체크 숙제 확인",badge:`미체크 ${stats.uncheckedHomework}`},
    {id:"material",icon:"▣",title:"준비물",description:"가져올 준비물 확인",badge:`미체크 ${materialUnchecked}`},
    {id:"events",icon:"★",title:"행사/공지",description:"다가오는 행사와 공지",badge:`${eventCount}개`},
    {id:"message",icon:"✉",title:"선생님께 메시지",description:"궁금한 점 보내기",badge:`안 읽음 ${stats.unreadMessages}`}
  ])}</div>`;
}
function messageTimeHtml(m){return noticeTsText(m.createdAt)}
function messageBubbleHtml(m,studentId){
  const mine=m.senderRole==="student" && m.senderId===studentId;
  return `<div class="messageBubble ${mine?"mine":"teacher"}"><div>${escapeHtml(m.text||"").replace(/\n/g,"<br>")}</div><small>${mine?"나":"선생님"} · ${messageTimeHtml(m)}</small></div>`;
}
function studentTeacherMessageHtml(id){
  const room=noticeState.studentRoom;
  if(room?.id && !activeMessageUnsub) subscribeMessagesForRoom(room.id);
  return `<div class="section">
    <div class="head"><div><h2>선생님께 메시지</h2><div class="sub">선생님께 궁금한 점이나 요청할 일을 보내세요.</div></div></div>
    <div class="messagePanel">
      <div class="messageList">${noticeState.messages.map(m=>messageBubbleHtml(m,id)).join("") || `<p class="small">아직 메시지가 없습니다.</p>`}</div>
      <div class="messageComposer"><textarea id="studentTeacherMessageText" maxlength="300" placeholder="300자 이내로 입력하세요"></textarea><button class="primary" onclick="sendStudentTeacherMessage()">보내기</button></div>
    </div>
  </div>`;
}
function teacherNoticeFormHtml(){
  return `<div class="section teacherNoticeCreateSection"><div class="head"><div><h2>알림 등록</h2><div class="sub">숙제, 준비물, 행사, 공지를 학생 알림장에 등록합니다.</div></div><button type="button" class="primary" onclick="saveClassroomNotice()">등록하기</button></div>
    <form class="teacherNoticeForm" onsubmit="event.preventDefault(); saveClassroomNotice();">
      <div class="grid g2"><div class="card">
        <div class="field"><label>제목</label><input id="noticeTitle" maxlength="80" autocomplete="off" placeholder="예: 수학 숙제, 체험학습 준비물"></div>
        <div class="field"><label>유형</label><select id="noticeType" onchange="updateNoticeTypeFields()">${NOTICE_TYPES.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}</select></div>
        <div id="noticeCheckItemsBox" class="noticeCheckItemsBox hidden">
          <label><b>숙제/준비물 선택 항목</b></label>
          <textarea id="noticeCheckItems" placeholder="예: 수학 익힘 42쪽&#10;예: 줄공책&#10;한 줄에 하나씩 적으면 학생 화면에 항목으로 표시됩니다." style="width:100%;min-height:110px;margin-top:8px"></textarea>
          <div class="toolbar"><button type="button" onclick="fillNoticeCheckPreset('homework')">숙제 예시</button><button type="button" onclick="fillNoticeCheckPreset('material')">준비물 예시</button></div>
        </div>
        <div class="field"><label>마감일/행사일</label><input id="noticeDueDate" type="date" value="${today()}"></div>
        <label class="checkLine"><input id="noticeImportant" type="checkbox"> 중요 알림</label>
        <div class="field"><label>대상</label><select id="noticeTargetType" onchange="toggleNoticeTargetStudents()"><option value="all">전체</option><option value="selected">개별 학생 선택</option></select></div>
        <div id="noticeTargetStudents" class="studentCheckGrid hidden">${students().map(s=>`<label><input type="checkbox" class="noticeTargetStudent" value="${s.id}"> ${escapeHtml(s.name)}</label>`).join("")}</div>
      </div><div class="card"><label><b>내용</b></label><textarea id="noticeContent" style="width:100%;min-height:210px;margin-top:8px" maxlength="1000" placeholder="학생에게 보여 줄 내용을 적으세요."></textarea><div class="teacherNoticeSubmitRow"><button type="submit" class="primary noticeSubmitBtn">알림 등록</button><button type="button" onclick="resetNoticeForm()">새 알림 쓰기</button></div><div id="noticeSaveHint" class="pendingHint">등록 버튼을 누르면 즉시 알림장에 저장됩니다.</div></div></div>
    </form>
  </div>`;
}
function teacherNoticeListHtml(){
  const rows=sortedNotices(noticeState.all);
  if(!rows.length) return `<p class="small">등록한 알림이 없습니다.</p>`;
  return `<div class="section"><div class="head"><div><h2>알림 목록</h2><div class="sub">항목을 누르면 학생별 체크 요일과 시간을 볼 수 있습니다.</div></div></div><div class="scroll"><table><thead><tr><th>유형</th><th>제목</th><th>대상</th><th>날짜</th><th>중요</th><th>처리</th></tr></thead><tbody>${rows.map(nc=>`<tr class="clickableNoticeRow" onclick="openTeacherNoticeDetail('${nc.id}')"><td>${noticeTypeInfo(nc.type).name}</td><td><b>${escapeHtml(nc.title||"")}</b><div class="small">${escapeHtml(nc.content||"").slice(0,80)}</div>${noticeCheckItemsHtml(nc)}</td><td>${(nc.targetType||"all")==="all"?"전체":arr(nc.targetStudentIds).map(studentName).join(", ")}</td><td>${noticeDateValue(nc.dueDate)||"-"}</td><td>${nc.important?"★":"-"}</td><td><button onclick="event.stopPropagation();openTeacherNoticeDetail('${nc.id}')">체크 현황</button> <button onclick="event.stopPropagation();editClassroomNotice('${nc.id}')">수정</button> <button class="danger" onclick="event.stopPropagation();deleteClassroomNotice('${nc.id}')">삭제</button></td></tr>`).join("")}</tbody></table></div>${selectedTeacherNoticeDetail?teacherNoticeDetailHtml(selectedTeacherNoticeDetail):""}</div>`;
}
function noticeStatusForTeacher(noticeId,studentId){
  return noticeState.teacherStatuses.find(s=>s.noticeId===noticeId && s.studentId===studentId) || null;
}
function teacherNoticeDetailHtml(noticeId){
  const nc=noticeState.all.find(n=>n.id===noticeId);
  if(!nc) return "";
  const stats=teacherCheckStats(nc);
  return `<div class="noticeDetailPanel card"><div class="head"><div><h3>${noticeTypeInfo(nc.type).name} · ${escapeHtml(nc.title||"")}</h3><div class="sub">${noticeDateValue(nc.dueDate)||"-"} · 대상 ${stats.targets.length}명</div></div><button onclick="closeTeacherNoticeDetail()">닫기</button></div>${noticeCheckItemsHtml(nc)}<div class="scroll"><table><thead><tr><th>학생</th><th>체크 상태</th><th>체크한 요일/시간</th><th>교사 확인</th><th>처리</th></tr></thead><tbody>${stats.targets.map(id=>{const s=noticeStatusForTeacher(nc.id,id); return `<tr><td><b>${studentName(id)}</b></td><td>${s?.checked?`<span class="pill blue">체크 완료</span>`:`<span class="pill orange">미체크</span>`}</td><td>${s?.checkedAt?noticeTsDetailText(s.checkedAt):"-"}</td><td>${s?.teacherConfirmed?`<span class="pill green">확인 완료</span><br><span class="small">${noticeTsDetailText(s.teacherConfirmedAt)}</span>`:`<span class="small">대기</span>`}</td><td><button class="green" onclick="confirmNoticeStatus('${nc.id}','${id}')" ${s?.teacherConfirmed?"disabled":""}>확인 완료</button></td></tr>`}).join("")}</tbody></table></div></div>`;
}
function teacherCheckStats(nc){
  const targets=noticeTargetsNotice(nc);
  const checked=targets.filter(id=>noticeStatusForTeacher(nc.id,id)?.checked);
  const confirmed=targets.filter(id=>noticeStatusForTeacher(nc.id,id)?.teacherConfirmed);
  return {targets,checked,confirmed,unchecked:targets.filter(id=>!noticeStatusForTeacher(nc.id,id)?.checked)};
}
function teacherCheckStatusHtml(){
  const rows=sortedNotices(noticeState.all).filter(nc=>["homework","material"].includes(nc.type));
  if(!rows.length) return `<div class="section"><p class="small">체크할 숙제/준비물 알림이 없습니다.</p></div>`;
  return `<div class="section"><div class="head"><div><h2>숙제/준비물 체크 현황</h2><div class="sub">학생별 체크와 교사 확인 상태를 관리합니다.</div></div><label><input type="checkbox" ${noticeUncheckedOnly?"checked":""} onchange="setNoticeUncheckedOnly(this.checked)"> 미체크 학생만 보기</label></div>${rows.map(nc=>{
    const st=teacherCheckStats(nc);
    const targetRows=(noticeUncheckedOnly?st.unchecked:st.targets);
    return `<div class="card clickableNoticeCard" style="margin-bottom:12px" onclick="openTeacherNoticeDetail('${nc.id}')"><div class="head"><div><h3>${noticeTypeInfo(nc.type).name} · ${escapeHtml(nc.title||"")}</h3><div class="sub">${noticeDateValue(nc.dueDate)||"-"} · 클릭하면 시간 상세를 봅니다</div></div><div class="toolbar"><span class="pill blue">대상 ${st.targets.length}</span><span class="pill green">체크 ${st.checked.length}</span><span class="pill purple">확인 ${st.confirmed.length}</span><span class="pill orange">미체크 ${st.unchecked.length}</span></div></div>
      ${noticeCheckItemsHtml(nc)}<div class="scroll" onclick="event.stopPropagation()"><table><thead><tr><th>학생</th><th>체크</th><th>체크 요일/시간</th><th>교사 확인</th><th>처리</th></tr></thead><tbody>${targetRows.map(id=>{const s=noticeStatusForTeacher(nc.id,id); return `<tr><td><b>${studentName(id)}</b></td><td>${s?.checked?`<span class="pill blue">체크 완료</span>`:`<span class="pill orange">미체크</span>`}</td><td>${s?.checkedAt?noticeTsDetailText(s.checkedAt):"-"}</td><td>${s?.teacherConfirmed?`<span class="pill green">확인 완료</span>`:`<span class="small">대기</span>`}</td><td><button class="green" onclick="confirmNoticeStatus('${nc.id}','${id}')" ${s?.teacherConfirmed?"disabled":""}>확인 완료</button></td></tr>`}).join("")}</tbody></table></div></div>`;
  }).join("")}</div>`;
}
function teacherRoomsHtml(){
  const q=teacherMessageSearch.trim();
  const rooms=noticeState.rooms.filter(r=>!q || studentName(r.studentId).includes(q) || String(r.lastMessage||"").includes(q));
  return `<div class="teacherMessageGrid"><div class="card"><div class="field"><label>검색</label><input value="${escapeHtml(teacherMessageSearch)}" oninput="setTeacherMessageSearch(this.value)" placeholder="학생 이름 또는 내용"></div><div class="messageRoomList">${rooms.map(r=>`<button class="messageRoomBtn ${selectedTeacherMessageRoom===r.id?"active":""} ${n(r.unreadByTeacher)>0?"unread":""}" onclick="openTeacherMessageRoom('${r.id}')"><b>${studentName(r.studentId)}</b><span>${escapeHtml(r.lastMessage||"").slice(0,42)}</span><em>${noticeTsText(r.lastMessageAt)}</em>${n(r.unreadByTeacher)>0?`<i>${n(r.unreadByTeacher)}</i>`:""}</button>`).join("") || `<p class="small">메시지방이 없습니다.</p>`}</div></div><div>${teacherRoomDetailHtml()}</div></div>`;
}
function teacherRoomDetailHtml(){
  const room=noticeState.rooms.find(r=>r.id===selectedTeacherMessageRoom);
  if(!room) return `<div class="card"><p class="small">학생 메시지방을 선택하세요.</p></div>`;
  return `<div class="card"><div class="head"><div><h3>${studentName(room.studentId)} 메시지방</h3><div class="sub">최근 메시지 50개</div></div></div><div class="messageList">${noticeState.messages.map(m=>messageBubbleHtml(m,room.studentId)).join("") || `<p class="small">메시지가 없습니다.</p>`}</div><div class="messageComposer"><textarea id="teacherReplyText" maxlength="300" placeholder="답장을 입력하세요"></textarea><button class="primary" onclick="sendTeacherReply()">답장</button></div></div>`;
}
function renderNoticeboardTeacher(){
  const allowedTeacherNoticeTabs=["create","list","checks","messages"];
  if(!allowedTeacherNoticeTabs.includes(selectedTeacherNoticeTab)){
    selectedTeacherNoticeTab="create";
    localStorage.setItem("teacherNoticeTab","create");
  }
  const teacherNoticeMenu = `<div class="noticeActionGrid">${[
    {id:"create",icon:"+",title:"알림 등록",description:"숙제, 준비물, 행사, 공지를 새로 작성"},
    {id:"list",icon:"≡",title:"알림 목록",description:"등록한 알림 수정/삭제",badge:`${noticeState.all.length}개`},
    {id:"checks",icon:"✓",title:"체크 현황",description:"학생별 숙제·준비물 체크 확인",badge:`미체크 ${todayUncheckedNoticeCount()}`},
    {id:"messages",icon:"✉",title:"학생 메시지함",description:"학생 메시지 전체 확인과 답장",badge:`미읽음 ${teacherUnreadMessages()}`}
  ].map(c=>`<button class="noticeActionCard ${selectedTeacherNoticeTab===c.id?"active":""}" onclick="setTeacherNoticeTab('${c.id}')"><span>${c.icon}</span><b>${c.title}</b><small>${c.description}</small>${c.badge?`<em>${c.badge}</em>`:""}</button>`).join("")}</div>`;
  if(isMobileViewport()){
    const renderPage=()=>{
      const tab=activeMobileTeacherPage;
      selectedTeacherNoticeTab=tab;
      const title={create:"알림 등록",list:"알림 목록",checks:"체크 현황",messages:"학생 메시지함"}[tab] || "알림장";
      const body=tab==="create"?teacherNoticeFormHtml():tab==="list"?teacherNoticeListHtml():tab==="checks"?teacherCheckStatusHtml():`<div class="section"><div class="head"><div><h2>학생 메시지함</h2><div class="sub">학생별 1:1 메시지방입니다.</div></div></div>${teacherRoomsHtml()}</div>`;
      return `${mobileSubPageHeader(title,"backMobileTeacherPage()")}${body}`;
    };
    document.getElementById("noticeboard").innerHTML = activeMobileTeacherPage
      ? `<div class="noticeboardPage">${renderPage()}</div>`
      : `<div class="noticeboardPage"><div class="section"><div class="head"><div><h2>알림장</h2><div class="sub">알림 등록, 체크 현황, 메시지함을 메뉴로 나눠 관리합니다.</div></div><span class="pill red">읽지 않은 메시지 ${teacherUnreadMessages()}</span></div>${mobileMenuGrid([
          {id:"create",icon:"+",title:"알림 등록",description:"숙제, 준비물, 행사, 공지 작성"},
          {id:"list",icon:"≡",title:"알림 목록",description:"등록한 알림 수정/삭제",badge:`${noticeState.all.length}개`},
          {id:"checks",icon:"✓",title:"숙제 체크 현황",description:"학생별 체크와 교사 확인"},
          {id:"checks",icon:"□",title:"준비물 체크 현황",description:"미체크 학생만 보기 지원"},
          {id:"messages",icon:"✉",title:"학생 메시지함",description:"학생 메시지 확인과 답장",badge:`미읽음 ${teacherUnreadMessages()}`}
        ].map(c=>({...c,onClick:`openMobileTeacherPage('${c.id}')`})))}</div></div>`;
    return;
  }
  document.getElementById("noticeboard").innerHTML=`<div class="noticeboardPage"><div class="section"><div class="head"><div><h2>알림장</h2><div class="sub">알림 등록, 체크 현황, 학생 메시지를 관리합니다.</div></div><span class="pill red">읽지 않은 메시지 ${teacherUnreadMessages()}</span></div>${teacherNoticeMenu}${noticeTabsHtml(selectedTeacherNoticeTab,true)}</div>${selectedTeacherNoticeTab==="create"?teacherNoticeFormHtml():selectedTeacherNoticeTab==="list"?teacherNoticeListHtml():selectedTeacherNoticeTab==="checks"?teacherCheckStatusHtml():`<div class="section"><div class="head"><div><h2>학생 메시지함</h2><div class="sub">학생별 1:1 메시지방입니다. 선택한 학생방의 전체 메시지를 표시합니다.</div></div></div>${teacherRoomsHtml()}</div>`}</div>`;
}
function studentSideNavHtml(active){
  return `<aside class="sideNav">
    <div class="sideBrand">경제<br>교실</div>
    <div class="sideNavScroll">${studentNavItems().map(([id,name,icon])=>`<button class="sideNavBtn ${active===id?'active':''}" onclick="setStudentTab('${id}')" title="${name}"><span>${icon}</span><b>${name}</b></button>`).join("")}</div>
    <button class="sideTeacherBtn" onclick="askTeacherPassword()" title="교사용 화면으로 이동"><span>♛</span><b>교사용</b></button>
  </aside>`;
}
function studentTabTitle(tab){
  return (studentNavItems().find(([id])=>id===tab)?.[1]) || "대시보드";
}
function studentAppHeaderHtml(s,id){
  const pending=arr(data.requests).filter(r=>r.studentId===id).length;
  return `<header class="tabletHeader">
    <div><h1>${studentTabTitle(studentTab)}</h1><div class="sub">${s.name} 학생 경제 앱</div></div>
    <div class="headerTools">
      <span class="headerBadge">보유 ${won(balanceOf(id))}</span>
      <span class="headerBadge">신청 ${pending}건</span>
      <button class="teacherAccessBtn" onclick="askTeacherPassword()">교사용</button>
      <div class="studentProfileMini">${staticAvatarHtml(id,true)}<div><b>${s.name}</b><span>${rankOfStudent(id)}위</span></div></div>
    </div>
  </header>`;
}
function bondSumOf(id){return arr(data.bonds).filter(b=>b.owner===id&&b.status==="active").reduce((a,b)=>a+n(b.principal),0)}
function ticketValueOf(id){return Object.entries(obj(obj(data.ticketHoldings)[id])).reduce((sum,[k,q])=>sum+n(q)*ticketSell(k),0)}
function inventoryValueOf(id){return Object.entries(obj(obj(data.inventories)[id])).reduce((sum,[pid,q])=>sum+n(q)*(publicPrice(product(pid)) ?? money(productPrice(product(pid)))),0)}
function inventoryHtml(id){
  const items=Object.entries(obj(obj(data.inventories)[id])).filter(([,q])=>n(q)>0);
  if(!items.length) return "없음";
  return `<span class="miniHoldingList">${items.map(([pid,q])=>{
    const p=product(pid);
    return `<span class="miniHoldingChip">${p?.name||pid} ${n(q)}개</span>`;
  }).join("")}</span>`;
}
function ticketHtml(id){
  const items=Object.entries(obj(obj(data.ticketHoldings)[id])).filter(([,q])=>n(q)>0);
  if(!items.length) return "없음";
  return `<span class="miniHoldingList">${items.map(([key,q])=>`<span class="miniHoldingChip">${ticketMeta[key]?.name||key} ${n(q)}장</span>`).join("")}</span>`;
}
function totalAssetsOf(id){return balanceOf(id)+n(obj(data.deposits)[id])+savingsValueOf(id)+bondSumOf(id)+ticketValueOf(id)+inventoryValueOf(id)+corporateEquityValueOf(id)}
function personalRankStudents(){
  return students().filter(s=>!isCorporationAssignedStudent(s.id));
}
function rankOfStudent(id){
  if(isCorporationAssignedStudent(id)) return "-";
  const sorted=personalRankStudents().map(s=>({id:s.id,v:totalAssetsOf(s.id)})).sort((a,b)=>b.v-a.v);
  return sorted.findIndex(x=>x.id===id)+1 || "-";
}
function assetRankingRows(){
  return personalRankStudents().map(s=>({
    id:s.id,
    name:s.name,
    cash:balanceOf(s.id),
    deposit:n(obj(data.deposits)[s.id]),
    savings:savingsValueOf(s.id),
    bonds:bondSumOf(s.id),
    inventory:inventoryValueOf(s.id),
    tickets:ticketValueOf(s.id),
    corporate:corporateEquityValueOf(s.id),
    total:totalAssetsOf(s.id)
  })).sort((a,b)=>b.total-a.total);
}
function friendStatusListHtml({mobile=false,limit=0}={}){
  const rows=assetRankingRows();
  const shown=limit>0 ? rows.slice(0,limit) : rows;
  if(!shown.length) return `<p class="small">등록된 학생이 없습니다.</p>`;
  const list=shown.map((r,i)=>{
    const status=studentStatusMessageOf(r.id);
    const jobName=studentJobName(student(r.id)) || "직업 없음";
    const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;
    return `<button class="friendRankRow ${i<3?`top${i+1}`:""}" onclick="openRankStudent('${r.id}')">
      <span class="friendRankNo">${medal}</span>
      <span class="friendAvatar">${staticAvatarHtml(r.id,true)}</span>
      <span class="friendMain"><b>${escapeHtml(r.name)}</b><em>${escapeHtml(status)}</em></span>
      <span class="friendMeta"><small>${escapeHtml(jobName)}</small><strong>${won(r.total)}</strong></span>
    </button>`;
  }).join("");
  return `<div class="friendRankList ${mobile?'mobileFriendRankList':'desktopFriendRankList'}" aria-label="학생 친구 목록 순위">${list}</div>`;
}
function assetRankingTableHtml(limit=0){
  const rows=assetRankingRows();
  const shown=limit>0 ? rows.slice(0,limit) : rows;
  if(!shown.length) return `<p class="small">등록된 학생이 없습니다.</p>`;
  if(isMobileViewport()){
    return friendStatusListHtml({mobile:true,limit});
  }
  return `<div class="scroll rankScroll"><table class="rankTable"><thead><tr><th>순위</th><th>학생</th><th>신용도</th><th class="num">현금</th><th class="num">예금</th><th class="num">채권</th><th class="num">상품</th><th class="num">티켓</th><th class="num">법인주식</th><th class="num">총자산</th></tr></thead><tbody>${shown.map((r,i)=>`<tr class="rankClickableRow ${i===0?'top1':i===1?'top2':i===2?'top3':''}" onclick="openRankStudent('${r.id}')"><td data-label="순위"><b>${i+1}위</b></td><td data-label="학생">${r.name}</td><td data-label="신용도">${creditScorePill(r.id)}</td><td class="num" data-label="현금">${won(r.cash)}</td><td class="num" data-label="예금">${won(r.deposit)}</td><td class="num" data-label="채권">${won(r.bonds)}</td><td class="num" data-label="상품">${won(r.inventory)}</td><td class="num" data-label="티켓">${won(r.tickets)}</td><td class="num" data-label="법인주식">${won(r.corporate)}</td><td class="num" data-label="총자산"><b>${won(r.total)}</b></td></tr>`).join("")}</tbody></table></div>`;
}
function corporationRankingRows(){
  return corporations().map(c=>({
    id:c.id,
    name:c.name || c.id,
    representative:studentName(c.representativeStudentId || c.representativeId || c.leaderId || ""),
    cash:corporationCashBalance(c),
    net:corporationNetAssetValue(c),
    sharePrice:corporationOfficialSharePrice(c),
    shareholders:Object.values(obj(c.shareholders)).filter(v=>n(v)>0).length,
    members:corporationMembers(c).length
  })).sort((a,b)=>b.net-a.net);
}
function corporationRankingTableHtml(limit=0){
  const rows=corporationRankingRows();
  const shown=limit>0 ? rows.slice(0,limit) : rows;
  if(!shown.length) return `<p class="small">등록된 법인이 없습니다.</p>`;
  if(isMobileViewport()){
    return `<div class="mobileRankOneLineList corpRankOneLineList" aria-label="법인 재산 순위">${shown.map((r,i)=>`<div class="mobileRankOneLine corp ${i===0?'top1':i===1?'top2':i===2?'top3':''}"><b class="rankNo">${i+1}위</b><span class="rankName">${r.name}</span><span class="rankCredit">${r.representative||'-'}</span><strong class="rankTotal">${won(r.net)}</strong></div>`).join("")}</div>`;
  }
  return `<div class="scroll rankScroll"><table class="rankTable corporationRankTable"><thead><tr><th>순위</th><th>법인</th><th>대표</th><th class="num">현금</th><th class="num">순자산</th><th class="num">공식 주가</th><th class="num">주주 수</th></tr></thead><tbody>${shown.map((r,i)=>`<tr class="${i===0?'top1':i===1?'top2':i===2?'top3':''}"><td data-label="순위"><b>${i+1}위</b></td><td data-label="법인"><b>${r.name}</b></td><td data-label="대표">${r.representative||"-"}</td><td class="num" data-label="현금">${won(r.cash)}</td><td class="num" data-label="순자산"><b>${won(r.net)}</b></td><td class="num" data-label="공식 주가">${won(r.sharePrice)}</td><td class="num" data-label="주주 수">${r.shareholders||r.members}명</td></tr>`).join("")}</tbody></table></div>`;
}
function dailyAssetCandles(id){
  const led=obj(derived.ledgerByAccount)[id] || [];
  const totalDelta=led.reduce((sum,e)=>sum+arr(e.lines).filter(l=>l.account===id).reduce((s,l)=>s+n(l.delta),0),0);
  let running=balanceOf(id)-totalDelta;
  const days={};
  led.forEach(e=>{
    const day=(e.ts||e.iso||"").slice(0,10) || today();
    if(!days[day]) days[day]={day,open:running,high:running,low:running,close:running};
    const delta=arr(e.lines).filter(l=>l.account===id).reduce((s,l)=>s+n(l.delta),0);
    running+=delta;
    days[day].high=Math.max(days[day].high,running);
    days[day].low=Math.min(days[day].low,running);
    days[day].close=running;
  });
  const todayKey=today();
  if(!days[todayKey]) days[todayKey]={day:todayKey,open:running,high:running,low:running,close:running};
  days[todayKey].close=totalAssetsOf(id);
  days[todayKey].high=Math.max(days[todayKey].high,totalAssetsOf(id));
  days[todayKey].low=Math.min(days[todayKey].low,totalAssetsOf(id));
  return Object.values(days).sort((a,b)=>a.day.localeCompare(b.day)).slice(-12);
}
function candleSvg(candles, opts={}){
  if(!candles.length) return `<div class="assetChart emptyChart">표시할 자산 기록이 없습니다.</div>`;
  const W=900,H=320,pad={l:82,r:28,t:28,b:70};
  const vals=candles.flatMap(c=>[n(c.open),n(c.high),n(c.low),n(c.close)]);
  let min=Math.min(...vals,0), max=Math.max(...vals,1);
  if(max===min){max+=1; min=Math.max(0,min-1);}
  const extra=(max-min)*0.08 || 1;
  max+=extra; min-=extra;
  const range=max-min;
  const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  const x=i=>pad.l+(W-pad.l-pad.r)*(candles.length===1?0.5:i/(candles.length-1));
  const bw=Math.max(12,Math.min(42,(W-pad.l-pad.r)/Math.max(1,candles.length)*0.5));
  const grid=[0,1,2,3,4].map(i=>{
    const yy=pad.t+(H-pad.t-pad.b)*i/4;
    const val=max-range*i/4;
    return `<line x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}" stroke="#e2e8f0"/><text x="12" y="${yy+4}" font-size="12" font-weight="700" fill="#475569">${Math.round(val).toLocaleString('ko-KR')}</text>`;
  }).join("");
  const zero=min<0 && max>0 ? `<line x1="${pad.l}" y1="${y(0)}" x2="${W-pad.r}" y2="${y(0)}" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${W-pad.r-4}" y="${y(0)-6}" text-anchor="end" font-size="11" font-weight="800" fill="#0f172a">0</text>` : "";
  const axis=`<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H-pad.b}" stroke="#94a3b8"/><line x1="${pad.l}" y1="${H-pad.b}" x2="${W-pad.r}" y2="${H-pad.b}" stroke="#94a3b8"/>`;
  const body=candles.map((c,i)=>{
    const xx=x(i), yo=y(c.open), yc=y(c.close), yh=y(c.high), yl=y(c.low);
    const up=n(c.close)>n(c.open), down=n(c.close)<n(c.open);
    const cls=up?'candleUp':down?'candleDown':'candleFlat';
    const top=Math.min(yo,yc), height=Math.max(5,Math.abs(yc-yo));
    const lab=(c.day||"").slice(5).replace("-","/");
    return `<line x1="${xx}" y1="${yh}" x2="${xx}" y2="${yl}" class="${cls}" stroke-width="4" stroke-linecap="round"/><rect x="${xx-bw/2}" y="${top}" width="${bw}" height="${height}" rx="2" class="${cls}"><title>${c.day}\n시가 ${won(c.open)}\n고가 ${won(c.high)}\n저가 ${won(c.low)}\n종가 ${won(c.close)}</title></rect><text x="${xx}" y="${H-28}" text-anchor="middle" font-size="12" font-weight="700" fill="#475569">${lab}</text>`;
  }).join("");
  return `<div class="assetChart"><svg class="assetCandleSvg" viewBox="0 0 ${W} ${H}">${grid}${zero}${axis}${body}</svg><div class="chartLegend"><span class="legendRed"></span>상승 <span class="legendBlue"></span>하락 <span class="legendGray"></span>변동 없음</div></div>`;
}
function assetChartHtml(id){
  return candleSvg(dailyAssetCandles(id));
}
function currentAssetPill(id){return `<span class="currentAssetPill">내 현재 총자산 ${won(totalAssetsOf(id))}</span>`}
function assetBreakdown(id){
  const cash=balanceOf(id), deposit=n(obj(data.deposits)[id]), savings=savingsValueOf(id), bonds=bondSumOf(id), inventory=inventoryValueOf(id), tickets=ticketValueOf(id), corporate=corporateEquityValueOf(id);
  return [{key:"cash",label:"현금",value:cash,color:"#2563eb"},{key:"deposit",label:"예금",value:deposit,color:"#10b981"},{key:"savings",label:"적금",value:savings,color:"#14b8a6"},{key:"bonds",label:"채권",value:bonds,color:"#7c3aed"},{key:"inventory",label:"상품",value:inventory,color:"#f97316"},{key:"tickets",label:"티켓 시세",value:tickets,color:"#f59e0b"},{key:"corporate",label:"법인 주식",value:corporate,color:"#8b5cf6"}];
}
function assetPieHtml(id){
  const parts=assetBreakdown(id).filter(p=>p.value>0);
  const total=parts.reduce((a,p)=>a+p.value,0);
  if(total<=0) return `<div class="assetPieEmpty">표시할 자산이 없습니다.</div>`;
  const r=42;
  const c=2*Math.PI*r;
  let offset=0;
  const circles=parts.map(p=>{
    const portion=p.value/total;
    const dash=Math.max(0.6, portion*c);
    const gap=Math.max(0, c-dash);
    const html=`<circle cx="50" cy="50" r="${r}" fill="none" stroke="${p.color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"></circle>`;
    offset += dash;
    return html;
  }).join("");
  return `<div class="assetPieWrap">
    <div class="assetPieSvgBox">
      <svg class="assetPieSvg" viewBox="0 0 100 100" role="img" aria-label="자산 구성 원형 그래프">
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="#ead7b8" stroke-width="14"></circle>
        <g transform="rotate(-90 50 50)">${circles}</g>
      </svg>
      <div class="assetPieCenter"><b>${won(total)}</b><span>총자산</span></div>
    </div>
    <div class="assetPieLegend">${parts.map(p=>`<div><i style="background:${p.color}"></i><span>${p.label}</span><b>${won(p.value)}</b></div>`).join("")}</div>
  </div>`;
}

function studentTodayIncome(id){
  return (obj(derived.ledgerByAccount)[id] || [])
    .filter(e=>e.day===today())
    .reduce((sum,e)=>sum+arr(e.lines).filter(l=>l.account===id && n(l.delta)>0).reduce((a,l)=>a+n(l.delta),0),0);
}
function studentAssetDeltaText(id){
  const candles=dailyAssetCandles(id);
  if(candles.length<2) return "오늘부터 기록 중";
  const diff=n(candles[candles.length-1].close)-n(candles[candles.length-2].close);
  return diff===0 ? "전일과 비슷" : `${diff>0?"+":"-"}${won(Math.abs(diff))}`;
}
function studentSummaryCardsHtml(id){
  const ticketValue=ticketValueOf(id);
  const corpValue=corporateEquityValueOf(id);
  return `<div class="tabletStatGrid">
    <div class="tabletStat blue"><span>잔고</span><b>${won(balanceOf(id))}</b><em>${studentAssetDeltaText(id)}</em></div>
    <div class="tabletStat green"><span>예금</span><b>${won(obj(data.deposits)[id]||0)}</b><em>안전 보관</em></div>
    <div class="tabletStat orange"><span>보유 티켓 가치</span><b>${won(ticketValue)}</b><em>현재 판매가 기준</em></div>
    <div class="tabletStat purple"><span>법인 지분 가치</span><b>${won(corpValue)}</b><em>공식 주가 기준</em></div>
    <div class="tabletStat yellow"><span>오늘 소득</span><b>${won(studentTodayIncome(id))}</b><em>오늘 입금 합계</em></div>
  </div>`;
}
function studentRequestSummaryHtml(id,limit=5){
  const rows=arr(data.requests).filter(r=>r.studentId===id).sort((a,b)=>(b.ts||"").localeCompare(a.ts||"")).slice(0,limit);
  if(!rows.length) return `<p class="small">대기 중인 신청이 없습니다.</p>`;
  return `<div class="requestMiniList">${rows.map(r=>`<div><b>${requestTypeName(r.type)}</b><span>${requestDesc(r)}</span><button class="requestCancelBtn" onclick="cancelRequest('${r.id}')">취소</button></div>`).join("")}</div>`;
}
function recommendedProductsHtml(){
  const list=arr(data.products).slice(0,4);
  if(!list.length) return `<p class="small">등록된 상품이 없습니다.</p>`;
  return `<div class="recommendGrid">${list.map(p=>`<button class="recommendCard" onclick="setStudentTab('products'); setTimeout(()=>showProductChart('${p.id}'),0)">
    <span class="pill ${p.secret?'orange':'blue'}">${p.kind}</span>
    <b>${p.name}</b>
    <strong>${publicPrice(p)===null?"비공개":won(publicPrice(p))}</strong>
  </button>`).join("")}</div>`;
}
function studentQuickActionsHtml(id){
  return `<div class="quickActionGrid">
    <div class="card"><h3>바로 송금</h3><div class="field"><label>받는 친구</label><select id="reqTo">${studentOptions()}</select></div><div class="field"><label>금액</label><input id="reqAmount" type="number" value="10"></div><button class="blue" onclick="requestTransfer()">송금</button><div class="pendingHint">확인 후 즉시 송금됩니다.</div></div>
    <div class="card"><h3>예금 신청</h3><div class="field"><label>금액</label><input id="reqDepositAmount" type="number" value="100"></div><div class="toolbar"><button class="blue" onclick="requestDepositIn()">입금 신청</button><button class="green" onclick="requestDepositOut()">출금 신청</button></div><div class="pendingHint">예금은 선생님 승인 후 처리됩니다.</div></div>
    <div class="card"><h3>채권 구매</h3><div class="sub">현재 교사 설정 금리: ${n(data.settings.bondRate)*100}%</div><div class="field"><label>금액</label><input id="reqBondAmount" type="number" value="100"></div><button class="orange" onclick="requestBond()">신청</button></div>
  </div>`;
}
function studentDashboardHeroHtml(id){
  const av=selectedAvatarItem(id);
  return `<div class="section dashboardAvatarHero">
    <div class="dashboardAvatarStage">${staticAvatarHtml(id,false)}</div>
    <div class="dashboardAvatarInfo">
      <span class="pill green">내 아바타</span>
      <h2>${studentName(id)} 학생</h2>
      <p class="small">현재 적용 아바타: <b>${av?.name||"기본 아바타"}</b></p>
      <div class="toolbar">${creditScorePill(id)}<span class="pill orange">직무유기 ${dutyStage(id)}단계</span></div>
      <div class="toolbar">
        <button class="blue" onclick="setStudentTab('cosmetic')">아바타 상점</button>
        <button onclick="showAvatarPreviewLarge('${av?.id||"avatar_01"}')">크게 보기</button>
      </div>
    </div>
  </div>`;
}


function studentStatusMessageOf(id){
  const raw = obj(data.studentStatusMessages)[id] ?? student(id)?.statusMessage ?? "";
  return String(raw || "").trim() || "우리 반 함께 성장하는 중";
}
function studentStatusMessageEditing(id){
  return window.__editingStudentStatusId === id;
}
function mobileStudentHomeLiteHtml(id, mode="self"){
  const s = student(id);
  if(!s) return `<div class="section"><p class="small">학생을 찾을 수 없습니다.</p></div>`;
  return `<div class="mobilePage mobileHomePage ${mode==="peer"?"peerHomePage":""}">
    ${mobileHomeAvatarHeroHtml(id,{viewer:mode})}
    ${mobileHomeInfoCardsHtml(id,{viewer:mode})}
  </div>`;
}
function mobileRankStudentHomeHtml(id){
  const s=student(id);
  if(!s) return `<div class="section"><p class="small">학생을 찾을 수 없습니다.</p></div>`;
  return `${mobileSubPageHeader(`${s.name} 홈`, "backMobilePage()")}${mobileStudentHomeLiteHtml(id,"peer")}`;
}

function mobileHomeMarketSignal(){
  const info=ticketPriceInfo("classClean");
  const rate=n(info.changeRate);
  if(rate>0.5) return {tone:"up",label:"상승",value:`▲ ${pct(rate)}`,note:"티켓 시장"};
  if(rate<-0.5) return {tone:"down",label:"하락",value:`▼ ${pct(Math.abs(rate))}`,note:"티켓 시장"};
  return {tone:"flat",label:"안정",value:"보합",note:"티켓 시장"};
}
function mobileHomeAvatarHeroHtml(id, options={}){
  const s=student(id) || {};
  const av=selectedAvatarItem(id);
  const credit=creditScoreInfo(id);
  const jobName=studentJobName(s)||"직업 없음";
  const rank=rankOfStudent(id);
  const canEdit=(options.viewer||"self")==="self" && id===selectedStudent;
  const editing=canEdit && studentStatusMessageEditing(id);
  const status=studentStatusMessageOf(id);
  const statusHtml=editing
    ? `<div class="mobileStatusEditor"><input id="studentStatusMessageInput" maxlength="30" value="${escapeHtml(status)}" onkeydown="if(event.key==='Enter') saveStudentStatusMessage('${id}')"><button class="green" onclick="saveStudentStatusMessage('${id}')">저장</button><button onclick="cancelStudentStatusEdit()">취소</button></div>`
    : `<button class="mobileStatusPlain ${canEdit?'editable':''}" ${canEdit?`onclick="editStudentStatusMessage('${id}')" title="상태메시지 수정"`:""}><span>${escapeHtml(status)}</span>${canEdit?materialIcon('edit','msIcon statusEditIcon'):''}</button>`;
  return `<section class="mobileHomeTopInfo mobileHomeTopInfoV110 mobileSnsTopInfo" aria-label="학생 프로필 요약">
    <div class="mobileHomeTopStripV110">
      <span class="mobileHomeMiniPillV110">${materialIcon('badge','metaIcon msIcon')}${jobName}</span>
      <span class="mobileHomeMiniPillV110">${materialIcon('workspace_premium','metaIcon msIcon')}${rank}위</span>
      <span class="mobileHomeMiniPillV110">${materialIcon('verified','metaIcon msIcon')}신용 ${credit.grade}</span>
      <span class="mobileHomeMiniPillV110">${materialIcon('styler','metaIcon msIcon')}${av?.name||"기본 아바타"}</span>
    </div>
    <button class="mobileHomeZoomBtnV110" onclick="showAvatarPreviewLarge('${av?.id||"avatar_01"}')">${materialIcon('zoom_out_map','msIcon')} 크게보기</button>
  </section>
  <section class="mobileHomeAvatarShowcase mobileHomeAvatarShowcaseV109 mobileSnsHero" aria-label="아바타 홈">
    <div class="mobileSnsNameBadge">${studentName(id)}</div>
    <div class="mobileSnsJobBadge">${materialIcon('business_center','msIcon')} 직업: ${escapeHtml(jobName)}</div>
    <div class="mobileSnsAvatarCircle"><div class="mobileHomeAvatarFigureV109">${staticAvatarHtml(id,false)}</div></div>
    <div class="mobileSnsStatus">${statusHtml}</div>
    <div class="mobileSnsCreditBadge">${materialIcon('verified_user','msIcon')} 신용도 ${credit.grade} · ${credit.score}점</div>
    <div class="mobileSnsAssetBadge">${materialIcon('account_balance_wallet','msIcon')} 자산 ${won(totalAssetsOf(id))}</div>
  </section>`;
}
function mobileEconomySummary(){
  const todayKey=today();
  const stats=currentEconomyStats(todayKey);
  const rows=economyHistoryRows(null,false).filter(r=>r.day<todayKey).sort((a,b)=>a.day.localeCompare(b.day));
  const prev=rows.length ? rows[rows.length-1] : null;
  const diff=prev ? n(stats.totalHoldings)-n(prev.totalHoldings) : 0;
  const rate=prev && n(prev.totalHoldings)>0 ? diff/n(prev.totalHoldings)*100 : 0;
  return {
    total: stats.totalHoldings,
    diff,
    rate,
    tone: diff>0 ? 'up' : diff<0 ? 'down' : 'flat',
    compareText: prev ? `${diff>0?'▲':diff<0?'▼':'•'} ${pct(Math.abs(rate))}` : '기록 없음',
    compareSub: prev ? `${signedWon(diff)}` : '첫 기록'
  };
}
function mobileHomeInfoCardsHtml(id, options={}){
  const econ=mobileEconomySummary();
  const credit=creditScoreInfo(id);
  return `<section class="mobileHomeInfoGrid mobileHomeInfoGridV109 mobileHomeInfoGridV125" aria-label="핵심 정보">
    <button class="mobileInfoCardV109 mobileInfoCardV125 ${econ.tone}" onclick="showTotalIncomeChart()">${infoCardIcon('account_balance_wallet')}<span>우리 반 총 열매</span><b>${won(econ.total)}</b><em>${econ.compareText} · 탭하여 차트 보기</em></button>
    <button class="mobileInfoCardV109 mobileInfoCardV125 credit" onclick="showCreditHelp()">${infoCardIcon('credit_card')}<span>신용도</span><b>${credit.grade}</b><em>${credit.score}점</em></button>
  </section>`;
}
function corporateHoldingSummaryHtml(id){
  const rows=studentCorporationShares(id);
  if(!rows.length) return "보유 법인지분 없음";
  return rows.map(({corporation:c,shares,value})=>`${c.name} ${shares}장(${shares}%, ${won(value)})${c.representativeStudentId===id?" · 대표":""}`).join(" / ");
}
function studentCorporationAssetTableHtml(id){
  const rows=studentCorporationShares(id);
  if(!rows.length) return `<p class="small">보유한 법인지분이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>법인</th><th class="num">보유 주식</th><th class="num">지분율</th><th class="num">공식 주가</th><th class="num">내 지분 가치</th><th>상태</th></tr></thead><tbody>${rows.map(({corporation:c,shares,value})=>`<tr><td><b>${c.name}</b></td><td class="num">${shares}장</td><td class="num">${shares}%</td><td class="num">${won(c.officialSharePrice)}</td><td class="num"><b>${won(value)}</b></td><td>${c.representativeStudentId===id?`<span class="pill green">대표</span>`:`<span class="pill blue">주주</span>`}</td></tr>`).join("")}</tbody></table></div>`;
}

function studentEconomyIndexHtml(){
  const todayKey=today();
  const stats=currentEconomyStats(todayKey);
  const rows=economyHistoryRows(null,false).filter(r=>r.day<todayKey).sort((a,b)=>a.day.localeCompare(b.day));
  const prev=rows.length ? rows[rows.length-1] : null;
  const diff=prev ? n(stats.totalHoldings)-n(prev.totalHoldings) : 0;
  const rate=prev && n(prev.totalHoldings)>0 ? diff/n(prev.totalHoldings)*100 : 0;
  const compareText=!prev ? "이전 기록 없음" : !n(prev.totalHoldings) ? "-" : pct(rate);
  const compareSub=prev ? `${prev.day} 기준` : "경제기록 저장 후 다음 비교부터 표시";
  return `<div class="section studentEconomyIndex">
    <div class="head"><div><h2>우리 반 경제지수</h2><div class="sub">우리 반 전체가 가진 열매의 총합입니다.</div></div><button onclick="showEconomyHelp()">도움말</button></div>
    <div class="studentEconomyIndexRow">
      <div><span>현재 전체 열매</span><b>${won(stats.totalHoldings)}</b></div>
      <div class="${diff>=0?'upText':'downText'}"><span>최근 기록 대비</span><b>${compareText}</b><em>${compareSub}</em></div>
    </div>
  </div>`;
}
function studentDashboardHtml(id){
  if(isMobileViewport()){
    return mobileStudentHomeLiteHtml(id,"self");
  }
  return `<div class="studentDashboard">
    ${studentDashboardHeroHtml(id)}
    ${studentEconomyIndexHtml()}
    ${fineNoticeHtml(id)}
    ${studentNoticeSummaryHtml(id)}

    <div class="section dashboardAssetPiePanel">
      <div class="head"><div><h2>자산 구성</h2><div class="sub">현금, 예금, 채권, 티켓, 법인지분 비율을 원형 그래프로 봅니다.</div></div></div>
      ${assetPieHtml(id)}
    </div>

    <div class="section creditAndWarningPanel">
      <div class="head"><div><h2>신용도·경고 현황</h2><div class="sub">대출/카드 기능은 나중에 연결하고, 지금은 투자 활동 참고 지표로만 사용합니다.</div></div><button onclick="showCreditHelp()">도움말</button></div>
      <div class="creditWarningGrid">${creditSummaryCard(id)}<div class="card"><h3>경고 기록</h3>${roleWarningRowsForStudent(id)}</div></div>
    </div>

    <div class="section panelFill dashboardAssetChartPanel">
      <div class="head"><div><h2>자산 추이</h2><div class="sub">내 총자산 흐름을 그래프로 확인합니다.</div></div></div>
      ${assetChartHtml(id)}
    </div>

    <div class="assetLayoutGrid dashboardHoldingsGrid">
      <div class="section assetHoldingsPanel"><div class="head"><div><h2>보유 현황</h2><div class="sub">상품, 티켓, 아바타, 미니룸 상태입니다.</div></div></div>
        <div class="card avatarMiniPanel">${avatarPreviewHtml(id)}</div>
        <p><b>보유 상품</b><br><span class="small">${inventoryHtml(id)}</span></p>
        <p><b>보유 티켓</b><br><span class="small">${ticketHtml(id)}</span></p>
        <p><b>보유 법인지분</b><br><span class="small">${corporateHoldingSummaryHtml(id)}</span></p>
        <p><b>보유 아바타</b><br><span class="small">${avatarOwnedSummary(id)}</span></p>
        <p><b>적용 미니룸</b><br><span class="small">${selectedRoomTemplate(id)?.icon||"집"} ${selectedRoomTemplate(id)?.name||"없음"}</span></p>
      </div>
      <div class="section corporationAssetDashboardPanel">
        <div class="head"><div><h2>보유 법인지분</h2><div class="sub">내 법인 주식은 재산으로 계산됩니다.</div></div></div>
        ${studentCorporationAssetTableHtml(id)}
      </div>
    </div>

    <div class="section dashboardSummaryBottom">
      <div class="head"><div><h2>자산 요약</h2><div class="sub">자산 카드 요약은 대시보드 하단에서만 확인합니다.</div></div><div class="assetRank">${rankOfStudent(id)}위</div></div>
      ${studentSummaryCardsHtml(id)}
    </div>
  </div>`;
}

function studentDailyIncomeRows(id){
  const days={};
  (obj(derived.ledgerByAccount)[id] || []).forEach(e=>{
    const day=e.day || (e.ts||"").slice(0,10) || "날짜 없음";
    const income=arr(e.lines).filter(l=>l.account===id && n(l.delta)>0).reduce((a,l)=>a+n(l.delta),0);
    if(income>0){
      if(!days[day]) days[day]={day,income:0,count:0};
      days[day].income+=income;
      days[day].count+=1;
    }
  });
  return Object.values(days).sort((a,b)=>b.day.localeCompare(a.day));
}
function studentDailyIncomeHtml(id){
  const rows=studentDailyIncomeRows(id);
  if(!rows.length) return `<p class="small">아직 기록된 소득이 없습니다.</p>`;
  const total=rows.reduce((a,r)=>a+r.income,0);
  return `<div class="scroll"><table><thead><tr><th>날짜</th><th class="num">소득</th><th class="num">입금 건수</th></tr></thead><tbody>${rows.slice(0,30).map(r=>`<tr><td>${r.day}</td><td class="num"><b>${won(r.income)}</b></td><td class="num">${r.count}</td></tr>`).join("")}</tbody><tfoot><tr><th>합계</th><th class="num">${won(total)}</th><th></th></tr></tfoot></table></div>`;
}

function assetStatusHtml(id){
  return `<div class="assetPage">
    <div class="section assetHeroPanel">
      <div class="head"><div><h2>재산현황</h2><div class="sub">현금, 예금, 채권, 상품, 티켓 시세를 합산해 보여줍니다.</div></div><div class="assetRank">${rankOfStudent(id)}위</div></div>
      <div class="tabletStatGrid assetStatGrid">
        <div class="tabletStat blue"><span>총자산</span><b>${won(totalAssetsOf(id))}</b><em>${studentAssetDeltaText(id)}</em></div>
        <div class="tabletStat green"><span>현금</span><b>${won(balanceOf(id))}</b><em>바로 사용 가능</em></div>
        <div class="tabletStat purple"><span>예금</span><b>${won(obj(data.deposits)[id]||0)}</b><em>승인 후 출금</em></div>
        <div class="tabletStat orange"><span>채권</span><b>${won(bondSumOf(id))}</b><em>원금 기준</em></div>
        <div class="tabletStat yellow"><span>티켓 시세 가치</span><b>${won(ticketValueOf(id))}</b><em>현재 판매가 기준</em></div>
      </div>
    </div>
    <div class="assetLayoutGrid">
      <div class="section"><div class="head"><div><h2>자산 구성</h2><div class="sub">내 재산이 어디에 들어 있는지 한눈에 봅니다.</div></div></div>${assetPieHtml(id)}</div>
      <div class="section assetHoldingsPanel"><div class="head"><div><h2>보유 현황</h2><div class="sub">상품, 티켓, 아바타, 미니룸 상태입니다.</div></div></div>
        <div class="card avatarMiniPanel">${avatarPreviewHtml(id)}</div>
        <p><b>보유 상품</b><br><span class="small">${inventoryHtml(id)}</span></p>
        <p><b>보유 티켓</b><br><span class="small">${ticketHtml(id)}</span></p>
        <p><b>보유 법인지분</b><br><span class="small">${corporateHoldingSummaryHtml(id)}</span></p>
        <p><b>보유 아바타</b><br><span class="small">${avatarOwnedSummary(id)}</span></p>
        <p><b>적용 미니룸</b><br><span class="small">${selectedRoomTemplate(id)?.icon||"집"} ${selectedRoomTemplate(id)?.name||"없음"}</span></p>
      </div>
    </div>
    <div class="section"><div class="head"><div><h2>내 자산 변동</h2><div class="sub">최근 거래 흐름과 현재 총자산을 캔들차트로 표시합니다.</div></div></div>${assetChartHtml(id)}</div>
    <div class="assetLayoutGrid">
      <div class="section"><div class="head"><div><h2>일자별 소득</h2><div class="sub">날짜별로 학생에게 들어온 열매 합계입니다.</div></div></div>${studentDailyIncomeHtml(id)}</div>
      <div class="section"><div class="head"><div><h2>최근 거래 내역</h2><div class="sub">내 거래의 세금 납부도 여기에서 처리합니다.</div></div></div>${studentRecentLedgerHtml(id,20,true)}</div>
    </div>
  </div>`;
}
function cosmeticShopHtml(id){
  const selected=selectedAvatarItem(id);
  return `<div class="avatarShopLayout">
    <div class="section avatarShopHero">
      <div class="head"><div><h2>아바타 상점</h2><div class="sub">구매한 아바타는 바로 적용할 수 있습니다.</div></div><div>${currentAssetPill(id)}</div></div>
      <div class="avatarCurrentCard">
        <div class="avatarCurrentPreview">${staticAvatarHtml(id,false)}</div>
        <div><span class="pill green">현재 적용 중</span><h3>${selected?.name||"기본 아바타"}</h3><p class="small">보유 열매 ${won(balanceOf(id))}</p><button class="blue" onclick="showAvatarPreviewLarge('${selected?.id||"avatar_01"}')">크게 보기</button></div>
      </div>
    </div>
    <div class="section avatarShopList">
      <div class="head"><div><h2>아바타 목록</h2><div class="sub">카드를 누르면 큰 미리보기 팝업이 열립니다.</div></div></div>
      <div class="storeCards">${avatarItemCatalog().map(it=>avatarItemCard(id,it)).join('')}</div>
    </div>
  </div>`;
}

function productOptionsOwned(studentId){
  const inv=obj(obj(data.inventories)[studentId]);
  const rows=Object.entries(inv).filter(([pid,q])=>n(q)>0 && product(pid));
  if(!rows.length) return `<option value="">보유 상품 없음</option>`;
  return rows.map(([pid,q])=>`<option value="${pid}">${product(pid).name} / 보유 ${n(q)}개</option>`).join("");
}
function ticketOptionsOwned(studentId){
  const hold=obj(obj(data.ticketHoldings)[studentId]);
  const rows=Object.keys(ticketMeta).filter(k=>n(hold[k])>0);
  if(!rows.length) return `<option value="">보유 티켓 없음</option>`;
  return rows.map(k=>`<option value="${k}">${ticketMeta[k].name} / 보유 ${n(hold[k])}장</option>`).join("");
}
function jobOptionsOwned(studentId){
  const ids=studentJobIds(student(studentId));
  if(!ids.length) return `<option value="">보유 직업 없음</option>`;
  return ids.map(id=>`<option value="${id}">${job(id)?.name||id}</option>`).join("");
}
function industryOptionsOwned(studentId,kind){
  const source=kind==="product" ? industryProducts() : industryMaterials();
  const rows=source.filter(item=>industryQty(studentId,item.id)>0);
  if(!rows.length) return `<option value="">보유 ${kind==="product"?"완제품":"재료"} 없음</option>`;
  return rows.map(item=>`<option value="${item.id}">${item.name} / 보유 ${industryQty(studentId,item.id)}개</option>`).join("");
}
function industryInventorySummary(studentId,kind){
  const source=kind==="product" ? industryProducts() : industryMaterials();
  const rows=source.filter(item=>industryQty(studentId,item.id)>0);
  if(!rows.length) return `<span class="small">없음</span>`;
  return `<div class="industryChipList">${rows.map(item=>`<span class="pill">${item.name} ${industryQty(studentId,item.id)}개</span>`).join("")}</div>`;
}
function industryRoleCardsHtml(studentId){
  const current=industryRoleState(studentId)?.role || "";
  return `<div class="grid g3">${industryRoles().map(role=>{
    const active=current===role.id;
    return `<div class="card ${active?'selectedCard':''}"><h3>${role.name}</h3><div class="sub">${role.description}</div><p class="small">선택비 ${won(role.fee)} · ${role.category}</p><button class="${active?'green':'blue'}" onclick="selectIndustryRole('${role.id}')">${active?'선택됨':'선택'}</button></div>`;
  }).join("")}</div>`;
}
function materialProductionCardsHtml(studentId){
  const role=industryRoleState(studentId)?.role || "";
  const locked=industryActionBlocked(studentId,"materialProduction");
  return `<div class="grid g3">${industryMaterials().map(item=>{
    const allowed=role && role===item.role;
    const disabled=!allowed || locked;
    const reason=!role?"산업 직업을 먼저 선택하세요.":!allowed?`${industryRole(item.role)?.name||"해당 직업"}만 생산 가능`:locked?"오늘은 완제품 제작을 선택했습니다.":"";
    return `<div class="card"><div class="head"><div><h3>${item.name}</h3><div class="sub">${item.description}</div></div><span class="pill green">${item.category}</span></div><p><b>${won(item.productionCost)}</b> 생산비</p><p class="small">${reason}</p><button class="blue" ${disabled?'disabled':''} onclick="produceIndustryMaterial('${item.id}')">1개 생산</button></div>`;
  }).join("")}</div>`;
}
function productManufacturingCardsHtml(studentId){
  const locked=industryActionBlocked(studentId,"productManufacturing");
  return `<div class="grid g3">${industryProducts().map(item=>{
    const missing=Object.entries(obj(item.materials)).filter(([mid,qty])=>industryQty(studentId,mid)<n(qty)).map(([mid,qty])=>`${industryMaterial(mid)?.name||mid} ${n(qty)-industryQty(studentId,mid)}개 부족`);
    const disabled=locked || missing.length>0;
    const reason=locked?"오늘은 재료 생산을 선택했습니다.":missing.join(" / ");
    return `<div class="card"><div class="head"><div><h3>${item.name}</h3><div class="sub">${item.description}</div></div><span class="pill orange">완제품</span></div><p class="small">필요 재료: ${industryRecipeText(item)}</p><p><b>${won(item.manufactureCost)}</b> 제조비</p><p class="small">${industryCostHint(item)}</p>${reason?`<p class="small">${reason}</p>`:""}<button class="green" ${disabled?'disabled':''} onclick="manufactureIndustryProduct('${item.id}')">1개 제작</button></div>`;
  }).join("")}</div>`;
}
function industryHtmlDesktop(studentId){
  return `<div class="section"><div class="head"><div><h2>생산·제작</h2><div class="sub">1차 산업 재료를 생산하거나, 재료를 조합해 완제품을 만듭니다.</div></div><div>${currentAssetPill(studentId)}</div></div>
    <div class="grid g3">
      <div class="card"><h3>내 산업 직업</h3><div class="value" style="font-size:26px">${industryRoleName(studentId)}</div><p class="small">기존 직업·임금과 별개로 생산·제작 전용 역할입니다.</p></div>
      <div class="card"><h3>오늘 행동</h3><p>${industryActionText(studentId)}</p></div>
      <div class="card"><h3>보유 현황</h3><p><b>재료</b></p>${industryInventorySummary(studentId,"material")}<p><b>완제품</b></p>${industryInventorySummary(studentId,"product")}</div>
    </div>
  </div>
  <div class="section"><div class="head"><div><h2>산업 직업 선택</h2><div class="sub">직업 변경 시 산업 재고가 모두 초기화됩니다.</div></div></div>${industryRoleCardsHtml(studentId)}</div>
  <div class="section"><div class="head"><div><h2>재료 생산</h2><div class="sub">오늘 재료를 생산하면 완제품 제작은 내일까지 막힙니다.</div></div></div>${materialProductionCardsHtml(studentId)}</div>
  <div class="section"><div class="head"><div><h2>완제품 제작</h2><div class="sub">오늘 완제품을 제작하면 재료 생산은 내일까지 막힙니다.</div></div></div>${productManufacturingCardsHtml(studentId)}</div>`;
}
function industryHtml(studentId){
  if(!isMobileViewport()) return industryHtmlDesktop(studentId);
  const pages={
    info:["내 직업 정보",`<div class="section"><div class="head"><div><h2>내 직업 정보</h2><div class="sub">직업, 오늘 활동, 보유 재료를 요약해서 봅니다.</div></div><div>${currentAssetPill(studentId)}</div></div><div class="grid g3"><div class="card"><h3>산업 직업</h3><div class="value" style="font-size:26px">${industryRoleName(studentId)}</div></div><div class="card"><h3>오늘 활동</h3><p>${industryActionText(studentId)}</p></div><div class="card"><h3>보유 현황</h3><p><b>재료</b></p>${industryInventorySummary(studentId,"material")}<p><b>제품</b></p>${industryInventorySummary(studentId,"product")}</div></div></div>`],
    work:["업무 제출",studentWorkClaimsHtml(studentId)],
    income:["임금 기록",studentDailyIncomeHtml(studentId)],
    role:["직업별 기능",roleWorkHtml(studentId)+industryHtmlDesktop(studentId)]
  };
  if(activeMobilePage && pages[activeMobilePage]) return `${mobileSubPageHeader(pages[activeMobilePage][0])}${pages[activeMobilePage][1]}`;
  return `<div class="section"><div class="head"><div><h2>직업</h2><div class="sub">필요한 직업 기능만 골라 이동합니다.</div></div></div>${mobileMenuGrid([
    {id:"info",icon:"⚙",title:"내 직업 정보",description:"직업과 오늘 활동 요약",badge:industryRoleName(studentId)},
    {id:"work",icon:"✓",title:"업무 제출",description:"검사가 필요한 업무 신청"},
    {id:"income",icon:"₩",title:"임금 기록",description:"받은 임금과 수입 확인"},
    {id:"role",icon:"▣",title:"직업별 기능",description:"경찰, 국세청, 은행장 등"}
  ])}</div>`;
}
function marketBoostCount(studentId,date=today()){return n(obj(obj(data.marketBoosts)[date])[studentId])}
function marketBoostBadge(studentId){const c=marketBoostCount(studentId); return c>0?`<span class="pill orange">상단 표시 ${c}장</span>`:""}
function marketSellerSortValue(seller,items){return marketBoostCount(seller)*100000 + items.length}

function marketListings(){
  return arr(data.marketListings).filter(l=>l && l.status==="open").sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
function marketListingName(l){
  if(l.kind==="product") return product(l.productId)?.name || l.name || "상품";
  if(l.kind==="ticket") return ticketMeta[l.ticketId]?.name || l.name || "티켓";
  if(l.kind==="job") return job(l.jobId)?.name || l.name || "직업";
  if(l.kind==="industryMaterial" || l.kind==="industryProduct") return industryItem(l.itemId)?.name || l.name || "산업 물품";
  return l.name || "자유 물품";
}
function marketListingCategory(l){
  if(l.category) return l.category;
  if(l.kind==="product") return "기존상품";
  if(l.kind==="ticket") return "티켓";
  if(l.kind==="custom") return "자유거래";
  if(l.kind==="job") return "직업";
  if(l.kind==="industryMaterial") return industryMaterial(l.itemId)?.category || "기타물품";
  if(l.kind==="industryProduct") return "완제품";
  return "기타물품";
}
function marketKindName(k){
  return k==="product"?"상품":k==="ticket"?"티켓":k==="job"?"직업":k==="industryMaterial"?"재료":k==="industryProduct"?"완제품":"자유거래";
}
function marketKindPillClass(kind,category){
  if(kind==="ticket") return "orange";
  if(kind==="industryProduct") return "orange";
  if(kind==="industryMaterial") return category==="농산물"?"green":category==="광산물"?"blue":"purple";
  if(kind==="custom") return "purple";
  if(kind==="job") return "green";
  return "blue";
}
function marketListingCostHint(l){
  if(l.kind==="industryMaterial" || l.kind==="industryProduct"){
    const hint=industryCostHint(industryItem(l.itemId));
    return hint ? `<div class="marketSmall">${hint}</div>` : "";
  }
  return "";
}
function marketListingMatches(l){
  const category=marketListingCategory(l);
  if(marketCategory && marketCategory!=="전체"){
    const wanted=marketCategory==="기타" ? "기타물품" : marketCategory;
    if(category!==wanted) return false;
  }
  const q=String(marketSearch||"").trim().toLocaleLowerCase("ko-KR");
  if(!q) return true;
  const text=[l.title,l.name,marketListingName(l),studentName(l.sellerId),l.note,category,marketKindName(l.kind)]
    .filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");
  return text.includes(q);
}
function marketListingCard(l,viewerId){
  const mine=l.sellerId===viewerId;
  const qty=n(l.qty)||1;
  const category=marketListingCategory(l);
  const pill=marketKindPillClass(l.kind,category);
  const created=l.createdAt ? new Date(l.createdAt).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "";
  const note=l.note?`<div class="marketNote">${l.note}</div>`:"";
  const rank=marketListingRank(l.id);
  const rankHtml=rank?`<span class="pill marketRankPill">시장 ${rank}번째</span>`:"";
  const previewBtn=mine?`<button class="compactBtn ${l.preview?'orange':'previewBtn'}" onclick="toggleMarketPreview('${l.id}')">${l.preview?'대표 해제':'대표 선택'}</button>`:"";
  return `<div class="marketListing ${mine?'mine':''} ${l.preview?'previewOn':''}">
    <div class="marketItemTop">
      <div class="marketItemMain">
        <div class="marketTitleRow"><span class="pill ${pill}">${category}</span><b>${marketListingName(l)}</b>${rankHtml}${l.preview?`<span class="pill orange">대표</span>`:""}</div>
        <div class="marketSubLine">${marketKindName(l.kind)} · 수량 ${qty}${created?` · ${created}`:""}</div>
        ${note}
        ${marketListingCostHint(l)}
      </div>
      <div class="marketBuyBox">
        <div class="marketPrice">${won(l.price)}</div>
        <div class="small">세금 ${won(tax(l.price))}</div>
        <div class="marketActions">${previewBtn}${mine?`<button class="danger compactBtn" onclick="cancelMarketListing('${l.id}')">취소</button>`:`<button class="green compactBtn" onclick="buyMarketListing('${l.id}')">구매</button>`}</div>
      </div>
    </div>
  </div>`;
}
function marketHomeView(){
  return (!marketCategory || marketCategory==="전체") && !String(marketSearch||"").trim();
}
const MARKET_GROUPS_PER_PAGE = 9;
function clampMarketPage(total){
  const max=Math.max(1,Math.ceil(total/MARKET_GROUPS_PER_PAGE));
  marketPage=Math.min(Math.max(1,Number(marketPage)||1),max);
  localStorage.setItem("marketPage",String(marketPage));
  return max;
}
function marketPagerHtml(total){
  const max=clampMarketPage(total);
  if(max<=1) return "";
  const pages=Array.from({length:max},(_,i)=>i+1);
  return `<div class="marketPager"><button class="compactBtn" ${marketPage<=1?"disabled":""} onclick="setMarketPage(${marketPage-1})">‹ 이전</button>${pages.map(p=>`<button class="compactBtn ${p===marketPage?'blue':''}" onclick="setMarketPage(${p})">${p}</button>`).join("")}<button class="compactBtn" ${marketPage>=max?"disabled":""} onclick="setMarketPage(${marketPage+1})">다음 ›</button><span class="small">${total}명 판매자 · ${marketPage}/${max}페이지</span></div>`;
}
function marketListingRank(id){
  const idx=marketListings().findIndex(l=>l.id===id);
  return idx>=0 ? idx+1 : 0;
}
function marketPreviewItems(items){
  return [...items].sort((a,b)=>{
    const ap=a.preview?1:0, bp=b.preview?1:0;
    if(ap!==bp) return bp-ap;
    return (b.createdAt||"").localeCompare(a.createdAt||"");
  }).slice(0,4);
}
function marketPreviewMiniCard(l,idx){
  const category=marketListingCategory(l);
  const pill=marketKindPillClass(l.kind,category);
  const qty=n(l.qty)||1;
  return `<div class="marketPreviewMini card${idx+1}">
    <div class="marketMiniTop"><span class="pill ${pill}">${category}</span>${l.preview?`<span class="pill orange">대표</span>`:""}</div>
    <b>${marketListingName(l)}</b>
    <div class="marketMiniMeta">${marketKindName(l.kind)} · ${qty}개</div>
    <div class="marketMiniPrice">${won(l.price)}</div>
  </div>`;
}
function marketLatestTs(items){return Math.max(0,...items.map(l=>new Date(l.createdAt||0).getTime()||0))}
function sortMarketGroupEntries(entries){
  return entries.sort((a,b)=>{
    const [sellerA,itemsA]=a, [sellerB,itemsB]=b;
    const boostDiff=marketBoostCount(sellerB)-marketBoostCount(sellerA);
    if(boostDiff) return boostDiff;
    if(marketSort==="latest") return marketLatestTs(itemsB)-marketLatestTs(itemsA) || studentName(sellerA).localeCompare(studentName(sellerB),"ko");
    if(marketSort==="price") return itemsB.reduce((s,l)=>s+n(l.price),0)-itemsA.reduce((s,l)=>s+n(l.price),0) || studentName(sellerA).localeCompare(studentName(sellerB),"ko");
    if(marketSort==="count") return itemsB.length-itemsA.length || studentName(sellerA).localeCompare(studentName(sellerB),"ko");
    const av=marketSellerSortValue(sellerA,itemsA), bv=marketSellerSortValue(sellerB,itemsB);
    return bv-av || studentName(sellerA).localeCompare(studentName(sellerB),"ko");
  });
}
function marketSellerDeckGroupHtml(groups,viewerId){
  const sorted=sortMarketGroupEntries(Object.entries(groups));
  const max=clampMarketPage(sorted.length);
  const start=(marketPage-1)*MARKET_GROUPS_PER_PAGE;
  const pageItems=sorted.slice(start,start+MARKET_GROUPS_PER_PAGE);
  return `${marketPagerHtml(sorted.length)}<div class="marketSellerDeckGrid">${pageItems.map(([seller,items])=>{
    const cats=[...new Set(items.map(marketListingCategory))];
    const total=items.reduce((sum,l)=>sum+n(l.price),0);
    const previews=marketPreviewItems(items);
    return `<div class="marketSellerDeck" onclick="showSellerMarketList('${seller}')" role="button" tabindex="0">
      <div class="marketSellerDeckHead">
        <div class="marketSellerIdentity"><div class="marketSellerAvatar">${staticAvatarHtml(seller,true)}</div><div><b>${studentName(seller)}</b><div class="small">판매자 전체 목록 보기 ${marketBoostBadge(seller)}</div></div></div>
        <div class="marketSellerStats"><span class="pill">${items.length}개</span><span class="pill blue">총 ${won(total)}</span></div>
      </div>
      <div class="marketSellerCats">${cats.slice(0,4).map(c=>`<span class="pill">${c}</span>`).join("")}</div>
      <div class="marketPreviewStack">${previews.map(marketPreviewMiniCard).join("")}</div>
      <div class="marketDeckFooter"><span>전체 판매목록 보기 →</span></div>
    </div>`;
  }).join("")}</div>${marketPagerHtml(sorted.length)}`;
}
function marketGroupedListingsHtml(list,viewerId){
  if(!list.length) return `<p class="small emptyMarket">조건에 맞는 판매글이 없습니다.</p>`;
  const groups={};
  list.forEach(l=>{const seller=l.sellerId||"unknown"; if(!groups[seller]) groups[seller]=[]; groups[seller].push(l);});
  if(marketHomeView()) return marketSellerDeckGroupHtml(groups,viewerId);
  const sorted=sortMarketGroupEntries(Object.entries(groups));
  const max=clampMarketPage(sorted.length);
  const start=(marketPage-1)*MARKET_GROUPS_PER_PAGE;
  const pageItems=sorted.slice(start,start+MARKET_GROUPS_PER_PAGE);
  return `${marketPagerHtml(sorted.length)}${pageItems.map(([seller,items])=>{
    const cats=[...new Set(items.map(marketListingCategory))];
    const total=items.reduce((sum,l)=>sum+n(l.price),0);
    return `<div class="marketSellerGroup">
      <div class="marketSellerTitle">
        <div><b>${studentName(seller)}</b> <span class="small">판매자</span> ${marketBoostBadge(seller)}</div>
        <div class="marketSellerStats"><span class="pill">${items.length}개</span><span class="pill blue">총 ${won(total)}</span>${cats.slice(0,3).map(c=>`<span class="pill">${c}</span>`).join("")}<button class="compactBtn" onclick="showSellerMarketList('${seller}')">전체보기</button></div>
      </div>
      <div class="marketListStack compactMarketList">${items.map(l=>marketListingCard(l,viewerId)).join("")}</div>
    </div>`;
  }).join("")}${marketPagerHtml(sorted.length)}`;
}
function marketSellerPopupHtml(sellerId,viewerId){
  const items=marketListings().filter(l=>l.sellerId===sellerId && marketListingMatches(l));
  const cats=[...new Set(items.map(marketListingCategory))];
  const total=items.reduce((sum,l)=>sum+n(l.price),0);
  return `<div class="marketSellerPopup">
    <div class="marketPopupSummary">
      <div><b>${studentName(sellerId)} 판매 목록</b><div class="sub">현재 필터 조건에 맞는 판매글 ${items.length}개 ${marketBoostBadge(sellerId)}</div></div>
      <div class="marketSellerStats"><span class="pill">${items.length}개</span><span class="pill blue">총 ${won(total)}</span>${cats.slice(0,5).map(c=>`<span class="pill">${c}</span>`).join("")}</div>
    </div>
    <div class="marketListStack popupMarketList">${items.map(l=>marketListingCard(l,viewerId)).join("") || `<p class="small emptyMarket">판매 중인 물건이 없습니다.</p>`}</div>
  </div>`;
}
function marketFilterHtml(){
  const cats=["전체","자유거래","서비스","직업","티켓","농산물","광산물","화석연료","완제품","기타물품"];
  return `<div class="marketFilterBar tabletMarketFilter marketFilterSelectBar">
    <div class="field compactField"><label>카테고리</label><select id="marketCategorySelect" onchange="setMarketCategory(this.value)">${cats.map(c=>`<option value="${c}" ${marketCategory===c?"selected":""}>${c==="기타물품"?"기타":c}</option>`).join("")}</select></div>
    <div class="field compactField searchField"><label>검색</label><input id="marketSearchInput" value="${marketSearch}" placeholder="제목, 물품, 판매자, 설명 검색" oninput="setMarketSearch(this.value)"></div>
    <div class="field compactField"><label>정렬</label><select id="marketSortSelect" onchange="setMarketSort(this.value)">
      <option value="boost" ${marketSort==="boost"?"selected":""}>상단 표시순</option>
      <option value="latest" ${marketSort==="latest"?"selected":""}>최신순</option>
      <option value="count" ${marketSort==="count"?"selected":""}>물품 많은순</option>
      <option value="price" ${marketSort==="price"?"selected":""}>총액 높은순</option>
    </select></div>
  </div>`;
}
function marketRegisterLauncherHtml(id){
  return `<div class="card marketRegisterLauncher unifiedMarketRegisterLauncher">
    <div class="marketRegisterLauncherHead"><div><h3>물품 등록</h3><div class="sub">티켓, 자유 물품, 재료, 완제품, 직업 판매를 한 화면에서 선택해 등록합니다.</div></div><span class="pill green">내 판매 ${marketListings().filter(l=>l.sellerId===id).length}개</span></div>
    <button class="marketRegisterUnifiedBtn" onclick="openMarketRegister()"><span>＋</span><b>물품 등록하기</b><small>종류 선택 후 팝업에서 한 번에 등록</small></button>
  </div>`;
}
function marketRegisterTypeOptions(selected="custom"){
  const rows=[
    ["custom","자유 물품"],
    ["ticket","티켓"],
    ["material","재료"],
    ["product","완제품"],
    ["job","직업"]
  ];
  return rows.map(([value,label])=>`<option value="${value}" ${value===selected?"selected":""}>${label}</option>`).join("");
}
function marketRegisterDialogHtml(type="custom",id){
  return `<div class="marketRegisterPopupBody unifiedMarketRegisterPopup">
    <div class="card unifiedRegisterCard">
      <div class="field"><label>등록할 물품 종류</label><select id="marketRegisterType" onchange="setMarketRegisterType(this.value)">${marketRegisterTypeOptions(type)}</select></div>
      <div class="marketRegisterFormBlock ${type==="ticket"?"active":""}" data-market-register="ticket">
        <h3>티켓 판매</h3><div class="sub">보유한 티켓 1장을 시장에 올립니다.</div>
        <div class="field"><label>티켓</label><select id="marketTicketId">${ticketOptionsOwned(id)}</select></div>
        <div class="field"><label>판매가</label><input id="marketTicketPrice" type="number" value="${ticketSell('classClean')}"></div>
      </div>
      <div class="marketRegisterFormBlock ${type==="custom"?"active":""}" data-market-register="custom">
        <h3>자유 물품</h3><div class="sub">직접 이름과 설명을 적어서 자유거래 상품을 등록합니다.</div>
        <div class="field"><label>카테고리</label><select id="marketCustomCategory">${marketCategoryOptions("기타물품",false)}</select></div>
        <div class="field"><label>이름</label><input id="marketCustomName" placeholder="예: 그림, 심부름권, 뽑기권"></div>
        <div class="field"><label>가격</label><input id="marketCustomPrice" type="number" value="100"></div>
        <div class="field"><label>설명</label><input id="marketCustomNote" placeholder="선택"></div>
      </div>
      <div class="marketRegisterFormBlock ${type==="material"?"active":""}" data-market-register="material">
        <h3>재료 판매</h3><div class="sub">보유한 산업 재료를 수량과 가격으로 등록합니다.</div>
        <div class="field"><label>재료</label><select id="marketIndustryMaterialId">${industryOptionsOwned(id,"material")}</select></div>
        <div class="field"><label>수량</label><input id="marketIndustryMaterialQty" type="number" value="1"></div>
        <div class="field"><label>판매가</label><input id="marketIndustryMaterialPrice" type="number" value="50"></div>
        <div class="field"><label>설명</label><input id="marketIndustryMaterialNote" placeholder="선택"></div>
      </div>
      <div class="marketRegisterFormBlock ${type==="product"?"active":""}" data-market-register="product">
        <h3>완제품 판매</h3><div class="sub">보유한 완제품을 수량과 가격으로 등록합니다.</div>
        <div class="field"><label>완제품</label><select id="marketIndustryProductId">${industryOptionsOwned(id,"product")}</select></div>
        <div class="field"><label>수량</label><input id="marketIndustryProductQty" type="number" value="1"></div>
        <div class="field"><label>판매가</label><input id="marketIndustryProductPrice" type="number" value="100"></div>
        <div class="field"><label>설명</label><input id="marketIndustryProductNote" placeholder="선택"></div>
      </div>
      <div class="marketRegisterFormBlock ${type==="job"?"active":""}" data-market-register="job">
        <h3>직업 판매</h3><div class="sub">등록하면 판매가 끝날 때까지 내 직업에서 잠시 빠집니다.</div>
        <div class="field"><label>직업</label><select id="marketJobId">${jobOptionsOwned(id)}</select></div>
        <div class="field"><label>판매가</label><input id="marketJobPrice" type="number" value="100"></div>
        <div class="pendingHint">등록하면 판매 완료 또는 취소 전까지 내 직업에서 빠집니다.</div>
      </div>
      <button class="primary unifiedRegisterSubmit" onclick="submitUnifiedMarketListing()">선택한 물품 등록</button>
    </div>
  </div>`;
}
window.openMarketRegister = function(type="custom"){
  const id=selectedStudent;
  if(!id) return toast("학생을 먼저 선택하세요.");
  const title=document.getElementById("detailTitle");
  const sub=document.getElementById("detailSub");
  const body=document.getElementById("detailBody");
  if(title) title.textContent="물품 등록";
  if(sub) sub.textContent=`${studentName(id)} · 등록할 종류를 고르고 정보를 입력하세요.`;
  if(body) body.innerHTML=marketRegisterDialogHtml(type,id);
  document.getElementById("detailModal")?.classList.remove("hidden");
}
window.setMarketRegisterType = function(type){
  const blocks=document.querySelectorAll("[data-market-register]");
  blocks.forEach(el=>el.classList.toggle("active",el.dataset.marketRegister===type));
}
window.submitUnifiedMarketListing = async function(){
  const type=document.getElementById("marketRegisterType")?.value || "custom";
  if(type==="ticket") return createTicketListing();
  if(type==="material") return createIndustryMaterialListing();
  if(type==="product") return createIndustryProductListing();
  if(type==="job") return createJobListing();
  return createCustomListing();
}
function marketHtmlDesktop(id){
  const open=marketListings().filter(marketListingMatches);
  const mine=open.filter(l=>l.sellerId===id);
  const others=open;
  return `<div class="section">
    <div class="head"><div><h2>시장</h2><div class="sub">학생끼리 상품·티켓·직업·산업 물품을 거래합니다. 카테고리와 검색으로 빠르게 찾을 수 있습니다.</div></div><div>${currentAssetPill(id)}</div></div>
    <div class="card marketBoostControl">
      <div><h3>상단 표시권 사용</h3><div class="sub">보유 ${n(obj(obj(data.ticketHoldings)[id]).topDisplay)}장 · 오늘 사용 ${marketBoostCount(id)}장. 사용한 매수만큼 첫 화면 판매자 정렬이 앞으로 올라갑니다.</div></div>
      <div class="toolbar"><input id="marketBoostUseQty" type="number" value="1" min="1" style="max-width:90px"><button class="orange" onclick="useTopDisplayPass()">사용하기</button></div>
    </div>
    ${marketRegisterLauncherHtml(id)}
  </div>
  <div class="section">
    <div class="head"><div><h2>판매 중인 물건</h2><div class="sub">전체 판매글을 확인합니다. 내 물품도 시장 몇 번째에 등록됐는지 함께 볼 수 있습니다.</div></div></div>
    ${marketFilterHtml()}
    <div id="marketOthersList">${marketGroupedListingsHtml(others,id)}</div>
  </div>
  <div class="section shareMarketInMarket">
    <div class="head"><div><h2>법인 지분 시장</h2><div class="sub">내 법인 지분을 매도하거나 친구가 올린 법인 주식을 구매합니다.</div></div></div>
    <div class="grid g2">
      <div class="card"><h3>내 보유 법인지분 매도</h3>${studentCorporationHoldingsHtml(id)}</div>
      <div class="card"><h3>현재 법인 주식 매물</h3>${shareMarketHtml(id)}</div>
    </div>
  </div>
  <div class="section">
    <div class="head"><div><h2>내 판매 목록</h2><div class="sub">판매 취소하면 맡겨둔 상품이나 티켓이 다시 돌아옵니다.</div></div></div>
    <div id="marketMineList" class="marketListStack">${mine.map(l=>marketListingCard(l,id)).join("") || `<p class="small">판매 중인 물건이 없습니다.</p>`}</div>
  </div>`;
}

function marketHtml(id){
  if(!isMobileViewport()) return marketHtmlDesktop(id);
  const pages={
    tickets:["티켓 시장",ticketMarketStudentHtml(id)],
    free:["자유시장",marketHtmlDesktop(id)],
    snacks:["과자 시장",productShopHtml(id)],
    history:["내 구매/판매 내역",`<div class="section"><div class="head"><div><h2>내 구매/판매 내역</h2><div class="sub">최근 거래를 카드형 목록으로 확인합니다.</div></div></div>${studentRecentLedgerHtml(id,40)}</div>`]
  };
  if(activeMobilePage && pages[activeMobilePage]) return `${mobileSubPageHeader(pages[activeMobilePage][0])}${pages[activeMobilePage][1]}`;
  const open=marketListings();
  const mine=open.filter(l=>l.sellerId===id).length;
  return `<div class="section"><div class="head"><div><h2>시장</h2><div class="sub">티켓, 자유시장, 과자 시장을 나눠서 봅니다.</div></div><div>${currentAssetPill(id)}</div></div>${mobileMenuGrid([
    {id:"tickets",icon:"▤",title:"티켓 시장",description:"티켓 구매, 판매, 사용 신청",badge:`보유 ${studentTicketCount(id)}`},
    {id:"free",icon:"▦",title:"자유시장",description:"학생끼리 물건을 사고팔기",badge:`내 판매 ${mine}`},
    {id:"snacks",icon:"□",title:"과자 시장",description:"상품 가격표와 구매 요청"},
    {id:"history",icon:"≡",title:"내 구매/판매 내역",description:"최근 거래와 요청 확인"}
  ])}</div>`;
}
function studentSellerOptions(viewerId){
  const rows=students().filter(s=>s.id!==viewerId);
  if(!rows.length) return `<option value="">판매자 없음</option>`;
  return `<option value="">판매자 선택</option>` + rows.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
}
function productShopHtml(id){
  return `<div class="productShopPage">
    <div class="section productShopTop">
      <div class="head"><div><h2>상품구매</h2><div class="sub">친구가 가진 상품을 신청하고, 기준 가격 흐름을 확인합니다.</div></div><div>${currentAssetPill(id)}</div></div>
      <div class="productTopGrid">
        <div class="card productBuyPanel">
          <h3>상품 구매 신청</h3>
          <div class="field"><label>판매자</label><select id="reqSeller">${studentSellerOptions(id)}</select></div>
          <div class="field"><label>상품</label><select id="reqProduct" onchange="fillProductUnitPrice()">${productOptions()}</select></div>
          <div class="field"><label>수량</label><input id="reqQty" type="number" value="1"></div>
          <div class="field"><label>개당 가격</label><input id="reqUnit" type="number" value="${firstProductPublicPrice()}"></div>
          <button class="primary" onclick="requestRetailBuy()">구매 신청</button>
          <div class="pendingHint">신청 후 선생님이 승인하면 거래가 완료됩니다.</div>
        </div>
        <div class="card incomeChartCard">
          <div class="head"><div><h3>일자별 총소득</h3><div class="sub">전체 청소 면제권 기준가로 보는 총소득 흐름입니다.</div></div><span class="pill orange">전체 청소 면제권</span></div>
          ${totalIncomeLineChartHtml()}
        </div>
      </div>
    </div>
    <div class="section">
      <div class="head"><div><h2>상품 가격표</h2><div class="sub">카드를 누르면 가격 차트를 크게 볼 수 있습니다.</div></div></div>
      <div class="productCompactCardGrid">${arr(data.products).map(p=>`<div class="productCompactCard" onclick="showProductChart('${p.id}')" title="${(p.note||"").replace(/"/g,'&quot;')}">
        <span class="productIcon small">${p.secret?"?":"₩"}</span>
        <b class="productCompactName">${p.name}</b>
        <span class="pill ${p.secret?'orange':'blue'}">${p.kind}</span>
        <strong class="productCompactPrice">${publicPrice(p)===null?"비공개":won(publicPrice(p))}</strong>
        <button onclick="event.stopPropagation();showProductChart('${p.id}')">차트</button>
      </div>`).join('')}</div>
    </div>
    ${studentHasRole(id,"snack_retailer")?snackRetailerPurchaseHtml(id):""}
    <div class="section"><div class="head"><div><h2>내 요청</h2><div class="sub">승인 대기 중인 요청을 확인하고 취소할 수 있습니다.</div></div></div>${myRequests(id)}</div>
  </div>`;
}
function totalTicketStock(){return Object.keys(ticketMeta).reduce((sum,k)=>sum+ticketStock(k),0)}
function studentTicketCount(id){return Object.values(obj(obj(data.ticketHoldings)[id])).reduce((sum,q)=>sum+n(q),0)}
function ticketMarketStudentHtml(id){
  const hold=obj(obj(data.ticketHoldings)[id]);
  return `<div class="ticketMarketPage">
    <div class="section">
      <div class="head"><div><h2>티켓시장</h2><div class="sub">구매, 판매, 사용 신청을 티켓별로 처리합니다.</div></div><div>${currentAssetPill(id)}</div></div>
      <div class="tabletStatGrid">
        <div class="tabletStat blue"><span>보유 열매</span><b>${won(balanceOf(id))}</b><em>구매 가능 금액</em></div>
        <div class="tabletStat green"><span>전체 티켓 재고</span><b>${totalTicketStock()}장</b><em>교사 설정 수량 기준</em></div>
        <div class="tabletStat orange"><span>내 티켓 보유</span><b>${studentTicketCount(id)}장</b><em>여러 장 보유 가능</em></div>
        <div class="tabletStat purple"><span>오늘 기준 가격</span><b>${won(basePrice("classClean"))}</b><em>전체 청소 면제권</em></div>
      </div>
    </div>
    <div class="section topDisplayNotice">
      <div class="head"><div><h2>상단 표시권</h2><div class="sub">시장 판매자를 앞쪽에 보이게 하는 티켓입니다.</div></div><span class="pill orange">가격 5열매 · 하루 재고 20장</span></div>
      <div class="topDisplayGrid">
        <div class="card"><b>내 보유량</b><div class="value">${n(hold.topDisplay)}장</div></div>
        <div class="card"><b>오늘 사용량</b><div class="value">${marketBoostCount(id)}장</div></div>
        <div class="card"><b>사용 효과</b><p class="small">사용한 장수만큼 시장 첫 화면에서 내 판매자 카드가 우선 표시됩니다.</p></div>
      </div>
    </div>
    <div class="section">
      <div class="head"><div><h2>티켓별 신청</h2><div class="sub">현재 구매가, 판매가, 재고와 내 보유량을 같이 확인합니다.</div></div></div>
      <div class="ticketCardGrid">${Object.keys(ticketMeta).map(k=>{
        const stock=ticketStock(k), disabled=stock<=0, mine=n(hold[k]);
        return `<div class="card ticketMarketCard" style="--ticket-color:${ticketMeta[k].color}"><div class="head"><div><h3>${ticketMeta[k].name}</h3><div class="sub">${ticketMeta[k].formula}</div></div>${ticketStockHtml(k)}</div>
          <div class="ticketPriceGrid"><div><span>구매가</span><b>${won(ticketBuy(k))}</b></div><div><span>판매가</span><b>${won(ticketSell(k))}</b></div><div><span>내 보유</span><b>${mine}장</b></div></div>
          <div class="ticketInventoryMeter"><div style="width:${Math.max(0,Math.min(100,stock/Math.max(1,n(ticketData(k).supply))*100))}%"></div></div>
          <div class="toolbar"><button onclick="showTicketChart('${k}')">차트</button><button class="blue" ${disabled?'disabled title="재고 없음"':''} onclick="requestTicketBuy('${k}')">구매 신청</button><button class="green" ${mine<=0?'disabled title="보유 티켓 없음"':''} onclick="requestTicketSell('${k}')">판매 신청</button><button class="orange" ${mine<=0?'disabled title="보유 티켓 없음"':''} onclick="requestTicketUse('${k}')">사용 신청</button></div>
          ${disabled?`<div class="pendingHint">재고가 없어 구매 신청이 막혀 있습니다.</div>`:""}
        </div>`;
      }).join("")}</div>
    </div>
    <div class="section"><div class="head"><div><h2>내 신청 내역</h2><div class="sub">티켓 관련 신청도 여기에서 취소할 수 있습니다.</div></div></div>${myRequests(id)}</div>
  </div>`;
}
function shopAndTicketStudentHtml(id){
  return `<div class="shopTicketMergedPage">
    <div class="section">
      <div class="head"><div><h2>상점·티켓·채권</h2><div class="sub">티켓, 채권 투자, 상품 가격표를 한 화면에서 확인합니다.</div></div><div>${currentAssetPill(id)}</div></div>
      <div class="toolbar shopTicketJump">
        <button class="orange" onclick="document.getElementById('mergedTicketMarket')?.scrollIntoView({behavior:'smooth',block:'start'})">티켓 보기</button>
        <button class="purple" onclick="document.getElementById('mergedBondMarket')?.scrollIntoView({behavior:'smooth',block:'start'})">채권 보기</button>
        <button class="blue" onclick="document.getElementById('mergedProductShop')?.scrollIntoView({behavior:'smooth',block:'start'})">상품 보기</button>
      </div>
    </div>
    <div id="mergedTicketMarket">${ticketMarketStudentHtml(id)}</div>
    <div id="mergedBondMarket">${bondMarketStudentHtml(id)}</div>
    <div id="mergedProductShop">${productShopHtml(id)}</div>
  </div>`;
}


function activeBondIssues(){
  return arr(data.bondIssues).filter(i=>(i.status||"active")==="active" && n(i.remaining)>0).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
function bondIssueName(i){return i?.name || `채권 ${won(i?.principal||0)}`}
function bondIssueCardHtml(i,studentId){
  const principal=money(i.principal);
  const rate=n(i.rate);
  const days=n(i.days||data.settings.bondDays||7);
  const pay=money(principal*(1+rate/100));
  const disabled=n(i.remaining)<=0 || balanceOf(studentId)<principal;
  return `<div class="card bondIssueCard">
    <div class="head"><div><h3>${bondIssueName(i)}</h3><div class="sub">교사 발행 채권 · 남은 재고 ${n(i.remaining)}장 / 총 ${n(i.total)}장</div></div><span class="pill orange">${rate}%</span></div>
    <div class="bondIssueGrid">
      <div><span>가격</span><b>${won(principal)}</b></div>
      <div><span>만기</span><b>${days}일</b></div>
      <div><span>예상 지급</span><b>${won(pay)}</b></div>
    </div>
    <p class="small">${i.note||"교사가 발행한 수량 안에서만 구매할 수 있습니다."}</p>
    <button class="orange" ${disabled?"disabled":""} onclick="requestBondIssue('${i.id}')">${disabled?"구매 불가":"채권 구매 신청"}</button>
  </div>`;
}
function bondIssueListHtml(studentId){
  const issues=activeBondIssues();
  if(!issues.length) return `<p class="small">현재 구매 가능한 교사 발행 채권이 없습니다.</p>`;
  return `<div class="bondIssueCardGrid">${issues.map(i=>bondIssueCardHtml(i,studentId)).join("")}</div>`;
}
function bondIssueOptions(){
  const issues=activeBondIssues();
  if(!issues.length) return `<option value="">발행 채권 없음</option>`;
  return issues.map(i=>`<option value="${i.id}">${bondIssueName(i)} / ${won(i.principal)} / ${n(i.rate)}% / 남은 ${n(i.remaining)}장</option>`).join("");
}
function activeBondRowsHtml(id){
  const rows=arr(data.bonds).filter(b=>b.owner===id && b.status==="active").sort((a,b)=>(a.mature||"").localeCompare(b.mature||""));
  if(!rows.length) return `<p class="small">보유 중인 채권이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>채권명</th><th>원금</th><th>금리</th><th>만기일</th><th class="num">예상 지급</th></tr></thead><tbody>${rows.map(b=>`<tr><td>${b.issueName||"채권"}</td><td>${won(b.principal)}</td><td>${n(b.rate)}%</td><td>${b.mature||"-"}</td><td class="num"><b>${won(n(b.principal)*(1+n(b.rate)/100))}</b></td></tr>`).join("")}</tbody></table></div>`;
}

function savingsRate(){return n(data.settings.depositRate)}
function depositInterestRateFromInput(){
  const input=document.getElementById("depositRate");
  const raw=input ? n(input.value)/100 : savingsRate();
  return Math.max(0,raw);
}
function depositInterestPeriodsFromInput(){
  const input=document.getElementById("depositInterestPeriods");
  return Math.max(1,Math.floor(input ? n(input.value) : 1));
}
function depositInterestRows(rate=depositInterestRateFromInput(),periods=depositInterestPeriodsFromInput()){
  return students().map(s=>{
    const principal=money(n(obj(data.deposits)[s.id]));
    const interest=money(principal*(Math.pow(1+rate,periods)-1));
    return {student:s,principal,interest,nextBalance:money(principal+interest)};
  }).filter(row=>row.principal>0 && row.interest>0);
}
function dateOnly(d=new Date()){return localDateString(d)}
function dateParts(iso){
  const [y,m,d]=String(iso||today()).slice(0,10).split("-").map(x=>Number(x));
  return {y:y||1970,m:m||1,d:d||1};
}
function dateUtcMs(iso){const p=dateParts(iso); return Date.UTC(p.y,p.m-1,p.d)}
function addDays(iso,days){
  const p=dateParts(iso);
  const d=new Date(p.y,p.m-1,p.d);
  d.setDate(d.getDate()+Math.floor(n(days)));
  return localDateString(d);
}
function daysBetween(a,b=today()){
  return Math.floor((dateUtcMs(b)-dateUtcMs(a))/(24*60*60*1000));
}
function activeSavings(id){return arr(data.savings).filter(s=>s.owner===id && s.status==="active").sort((a,b)=>(a.mature||"").localeCompare(b.mature||""))}
function savingInstallment(s){return money(s.installment ?? s.amount ?? 0)}
function savingProjection(s,asOf=today()){
  const rate=(n(s.rate)||Math.round(savingsRate()*100))/100;
  let balance=money(s.balance ?? s.totalPaid ?? 0);
  let last=s.lastInterestAt || s.start || asOf;
  const weeks=Math.max(0,Math.floor(daysBetween(last,asOf)/7));
  for(let i=0;i<weeks;i++) balance=money(balance*(1+rate));
  return {balance,weeks,lastInterestAt:addDays(last,weeks*7)};
}
function savingsValueOf(id){return activeSavings(id).reduce((sum,s)=>sum+savingProjection(s).balance,0)}
function savingsSumOf(id){return savingsValueOf(id)}
function savingLastPaidDate(s){
  if(s.lastPaidDate) return String(s.lastPaidDate).slice(0,10);
  const rows=(derived.ledger || []).filter(e=>obj(e.meta).savingId===s.id && typeText(e).includes("적금납입")).sort((a,b)=>(b.day||"").localeCompare(a.day||""));
  return rows[0]?.day || "";
}
function savingNextPayDate(s){
  const lastPaid=savingLastPaidDate(s);
  if(lastPaid) return addDays(lastPaid,SAVING_PAYMENT_INTERVAL_DAYS);
  return String(s.nextPayDate || s.start || today()).slice(0,10);
}
function canPaySaving(s){return daysBetween(savingNextPayDate(s),today())>=0}
function savingsRowsHtml(id){
  const rows=activeSavings(id);
  if(!rows.length) return `<p class="small">가입 중인 적금이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>가입일</th><th>만기일</th><th class="num">2일 납입액</th><th class="num">납입원금</th><th class="num">현재 평가액</th><th>다음 납입</th><th>처리</th></tr></thead><tbody>${rows.map(s=>{
    const due=new Date((s.mature||"")+"T00:00:00")<=new Date();
    const projected=savingProjection(s);
    const installment=savingInstallment(s);
    const next=savingNextPayDate(s);
    return `<tr><td>${s.start||"-"}</td><td>${s.mature||"-"}</td><td class="num">${won(installment)}</td><td class="num">${won(s.totalPaid||0)}</td><td class="num"><b>${won(projected.balance)}</b><br><span class="small">매주 복리 ${n(s.rate)||Math.round(savingsRate()*100)}%</span></td><td>${next}${canPaySaving(s)?`<br><span class="pill green">납입 가능</span>`:""}</td><td><div class="toolbar"><button class="blue" onclick="paySavingInstallment('${s.id}')" ${canPaySaving(s)?"":"disabled"}>납입</button>${due?`<button class="green" onclick="matureSaving('${s.id}')">만기 수령</button>`:""}<button class="danger" onclick="cancelSaving('${s.id}')">중도해지</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function depositHoldingRowsHtml(){
  const rows=students().map(s=>{
    const balance=money(n(obj(data.deposits)[s.id]));
    const rate=savingsRate();
    return {student:s,balance,interest:money(balance*rate)};
  }).filter(row=>row.balance>0).sort((a,b)=>b.balance-a.balance);
  if(!rows.length) return `<p class="small">현재 예금에 가입한 학생이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>상품</th><th>만기</th><th class="num">예금 잔액</th><th class="num">1회 예상 이자</th><th>처리</th></tr></thead><tbody>${rows.map(row=>`<tr>
    <td><b>${row.student.name}</b></td>
    <td>예금통장</td>
    <td><span class="pill blue">수시 입출금</span></td>
    <td class="num"><b>${won(row.balance)}</b></td>
    <td class="num">${won(row.interest)}</td>
    <td><button class="purple" onclick="payDepositInterestForStudent('${row.student.id}')">이자 지급</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}
function savingsHoldingRowsHtml(){
  const rows=arr(data.savings).filter(s=>s && s.status==="active").sort((a,b)=>(a.mature||"").localeCompare(b.mature||""));
  if(!rows.length) return `<p class="small">현재 가입 중인 적금 상품이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>상품</th><th>가입일</th><th>만기일</th><th class="num">납입원금</th><th class="num">현재 평가액</th><th class="num">발생 이자</th><th>상태</th><th>처리</th></tr></thead><tbody>${rows.map(s=>{
    const projected=savingProjection(s);
    const current=money(s.balance ?? s.totalPaid ?? 0);
    const interest=money(Math.max(0,projected.balance-current));
    const due=new Date((s.mature||"")+"T00:00:00")<=new Date();
    return `<tr>
      <td><b>${studentName(s.owner)}</b></td>
      <td>적금통장<br><span class="small">${SAVING_PAYMENT_INTERVAL_DAYS}일마다 ${won(savingInstallment(s))}</span></td>
      <td>${s.start||"-"}</td>
      <td>${s.mature||"-"}</td>
      <td class="num">${won(s.totalPaid||0)}</td>
      <td class="num"><b>${won(projected.balance)}</b><br><span class="small">매주 복리 ${n(s.rate)||Math.round(savingsRate()*100)}%</span></td>
      <td class="num">${won(interest)}${projected.weeks>0?`<br><span class="small">${projected.weeks}회분</span>`:""}</td>
      <td>${due?`<span class="pill green">만기</span>`:`<span class="pill orange">진행 중</span>`}</td>
      <td><div class="toolbar"><button class="purple" onclick="paySavingInterest('${s.id}')">이자 지급</button>${due?`<button class="green" onclick="matureSaving('${s.id}')">만기 지급</button>`:""}<button class="blue" onclick="paySavingInstallment('${s.id}')" ${canPaySaving(s)?"":"disabled"}>납입</button></div></td>
    </tr>`;
  }).join("")}</tbody></table></div>`;
}
function activeLoans(id){return arr(data.loans).filter(l=>l.owner===id && l.status==="active").sort((a,b)=>(a.due||"").localeCompare(b.due||""))}
function activeLoanBalance(id){return activeLoans(id).reduce((sum,l)=>sum+money(n(l.amount)*(1+n(l.rate)/100)),0)}
function loanPrincipalSum(id){return activeLoans(id).reduce((sum,l)=>sum+n(l.amount),0)}
function loanRowsHtml(id){
  const rows=activeLoans(id);
  if(!rows.length) return `<p class="small">상환 중인 대출이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>대출일</th><th>상환일</th><th class="num">원금</th><th class="num">금리</th><th class="num">상환액</th><th>처리</th></tr></thead><tbody>${rows.map(l=>{
    const due=new Date((l.due||"")+"T00:00:00")<=new Date();
    const pay=money(n(l.amount)*(1+n(l.rate)/100));
    return `<tr><td>${l.start||"-"}</td><td>${l.due||"-"}</td><td class="num">${won(l.amount)}</td><td class="num">${n(l.rate)}%</td><td class="num"><b>${won(pay)}</b></td><td><button class="${due?'orange':'green'}" onclick="repayLoan('${l.id}')">상환</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function creditLoanMultiplier(id){
  const g=creditScoreInfo(id).grade;
  return g==="S"?1.4:g==="A"?1.2:g==="B"?1:g==="C"?0.8:g==="D"?0.5:0.25;
}
function suggestedLoanRate(id){
  const g=creditScoreInfo(id).grade;
  return g==="S"?2:g==="A"?3:g==="B"?5:g==="C"?8:g==="D"?12:18;
}
function loanLimitInfo(id){
  const asset=totalAssetsOf(id);
  const income=Math.max(0,recentIncomeOf(id,7));
  const ltv=money(asset*0.5);
  const dsr=money(Math.max(100,income*3));
  const multiplier=creditLoanMultiplier(id);
  const gross=money(Math.min(ltv,dsr)*multiplier);
  const debt=activeLoanBalance(id);
  const available=Math.max(0,money(gross-debt));
  return {asset,income,ltv,dsr,multiplier,gross,debt,available,grade:creditScoreInfo(id).grade,score:creditScoreInfo(id).score};
}
function loanLimitCardHtml(id){
  const x=loanLimitInfo(id);
  return `<div class="loanLimitCard">
    <div><span>LTV 한도</span><b>${won(x.ltv)}</b><em>현재 자산의 50%</em></div>
    <div><span>DSR 한도</span><b>${won(x.dsr)}</b><em>최근 7일 소득 × 3</em></div>
    <div><span>신용 보정</span><b>${x.grade}</b><em>배율 ${x.multiplier}</em></div>
    <div><span>남은 대출한도</span><b>${won(x.available)}</b><em>기존 대출 차감</em></div>
  </div>`;
}
function bondMarketStudentHtml(id){
  return `<div class="section bondMarketPanel">
    <div class="head"><div><h2>채권 투자</h2><div class="sub">교사가 발행한 채권 재고 안에서만 구매할 수 있습니다.</div></div><span class="pill orange">투자 상품</span></div>
    <div class="financeGrid">
      <div class="card"><h3>구매 가능 채권</h3>${bondIssueListHtml(id)}</div>
      <div class="card"><h3>내 보유 채권</h3>${activeBondRowsHtml(id)}</div>
    </div>
  </div>`;
}
function bankbookTypes(){
  return [
    {id:"cash",name:"입출금통장",tone:"green",icon:"🌱",desc:"일상적인 거래와 자금 관리를 위한 통장입니다.",badge:"사용 가능"},
    {id:"deposit",name:"예금통장",tone:"blue",icon:"🌳",desc:"목돈을 안전하게 보관하고 이자를 받는 통장입니다.",badge:`이자율 ${Math.round(n(data.settings.depositRate)*100)}%`},
    {id:"saving",name:"적금통장",tone:"orange",icon:"💰",desc:"정기적으로 저축하여 목돈을 마련하는 통장입니다.",badge:"매주 복리"},
    {id:"investment",name:"투자통장",tone:"purple",icon:"📊",desc:"티켓, 채권 등 투자 자산을 확인하는 통장입니다.",badge:"투자 가능"},
    {id:"loan",name:"대출통장",tone:"red",icon:"🏠",desc:"대출을 관리하고 상환하는 통장입니다.",badge:"상환 관리"}
  ];
}
function bankbookById(id){return bankbookTypes().find(b=>b.id===id) || bankbookTypes()[0]}
function bankSummaryInfo(id){
  const cash=balanceOf(id);
  const deposit=n(obj(data.deposits)[id]);
  const savings=savingsValueOf(id);
  const ticket=ticketValueOf(id);
  const bond=bondCurrentValueOf(id);
  const corporate=corporateEquityValueOf(id);
  const debt=activeLoanBalance(id);
  const unpaid=unpaidFinesForStudent(id).reduce((sum,f)=>sum+remainingFineAmount(f),0);
  const totalAssets=money(cash+deposit+savings+ticket+bond+corporate);
  const totalDebt=money(debt+unpaid);
  return {cash,deposit,savings,ticket,bond,corporate,debt,unpaid,totalAssets,totalDebt,net:money(totalAssets-totalDebt)};
}
function bankSummaryCardsHtml(id){
  const x=bankSummaryInfo(id);
  return `<div class="tabletStatGrid bankSummaryGrid">
    <div class="tabletStat blue"><span>사용 가능 금액</span><b>${won(x.cash)}</b><em>바로 사용 가능</em></div>
    <div class="tabletStat green"><span>총자산</span><b>${won(x.totalAssets)}</b><em>예금 + 투자</em></div>
    <div class="tabletStat orange"><span>총부채</span><b>${won(x.totalDebt)}</b><em>대출 + 미납금</em></div>
    <div class="tabletStat purple"><span>순자산</span><b>${won(x.net)}</b><em>총자산 - 총부채</em></div>
  </div>`;
}
function bankbookCoverHtml(book,selected=false){
  return `<button class="bankbookRow ${selected?"selected":""}" onclick="setBankbook('${book.id}')">
    <span class="bankbookCover bankbook-${book.tone}"><b>${book.name}</b><em>CLASS BANK</em><i>${book.icon}</i></span>
    <span class="bankbookRowText"><strong>${book.name}</strong><small>${book.desc}</small><span class="pill ${book.tone==="red"?"orange":book.tone}">${book.badge}</span></span>
    <span class="bankbookCheck" aria-hidden="true"><span>${selected?"✓":"›"}</span></span>
  </button>`;
}
function bankbookSelectHtml(){
  return `<div class="section bankbookSelectPanel">
    <div class="head"><div><h2>통장 선택</h2><div class="sub">조회하거나 관리할 통장을 선택하세요.</div></div></div>
    <div class="bankbookList">${bankbookTypes().map(b=>bankbookCoverHtml(b,false)).join("")}</div>
  </div>`;
}
function bankbookTabsHtml(active){
  return `<div class="bankbookTabs">${bankbookTypes().map(b=>`<button class="bankbookTab bankbookTab-${b.tone} ${b.id===active?"active":""}" onclick="setBankbook('${b.id}')"><span class="bankbookTabIcon">${b.icon}</span><span>${b.name}</span></button>`).join("")}</div>`;
}
function bankRequestHistoryHtml(id,types){
  const list=arr(data.requests).filter(r=>r.studentId===id && types.includes(r.type)).sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
  if(!list.length) return `<p class="small">진행 중인 신청이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>시간</th><th>신청</th><th>내용</th><th>취소</th></tr></thead><tbody>${list.map(r=>`<tr><td>${seoulDateTimeText(r.ts)}</td><td>${requestTypeName(r.type)}</td><td>${requestDesc(r)}</td><td><button class="requestCancelBtn" onclick="cancelRequest('${r.id}')">취소</button></td></tr>`).join("")}</tbody></table></div>`;
}
function studentLedgerEntries(id,limit=20){
  const rows=[...(obj(derived.ledgerByAccount)[id] || [])]
    .map(e=>{
      const delta=arr(e.lines).filter(l=>l.account===id).reduce((sum,l)=>sum+n(l.delta),0);
      return {...e,delta:money(delta)};
    })
    .filter(e=>e.delta!==0)
    .sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
  return limit ? rows.slice(0,limit) : rows;
}
function allStudentLedgerHtml(limit=80){
  const rows=arr(data.ledger)
    .map(e=>{
      const studentLines=arr(e.lines).filter(l=>l.account!==CENTRAL && student(l.account));
      return {...e,studentLines};
    })
    .filter(e=>e.studentLines.length)
    .sort((a,b)=>(b.ts||"").localeCompare(a.ts||""))
    .slice(0,limit);
  if(!rows.length) return `<p class="small">최근 거래 내역이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>시간</th><th>내용</th><th>학생</th><th class="num">금액</th></tr></thead><tbody>${rows.map(e=>{
    const when=e.ts ? seoulDateTimeText(e.ts) : (e.day||"-");
    const names=e.studentLines.map(l=>studentName(l.account)).join(" / ");
    const amount=e.studentLines.reduce((sum,l)=>sum+n(l.delta),0);
    return `<tr><td>${when}</td><td>${e.desc||e.type||"-"}</td><td>${names}</td><td class="num ${amount>=0?"ledgerPlus":"ledgerMinus"}">${amount>=0?"+":""}${won(amount)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function studentRecentLedgerHtml(id,limit=20,showTax=false){
  const rows=studentLedgerEntries(id,limit);
  if(!rows.length) return `<p class="small">최근 거래 내역이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>시간</th><th>내용</th><th class="num">금액</th>${showTax?`<th>세금</th>`:""}</tr></thead><tbody>${rows.map(e=>{
    const when=e.ts ? seoulDateTimeText(e.ts) : (e.day||"-");
    const cls=e.delta>=0?"ledgerPlus":"ledgerMinus";
    return `<tr><td>${when}</td><td>${e.desc||e.type||"-"}</td><td class="num ${cls}">${e.delta>=0?"+":""}${won(e.delta)}</td>${showTax?`<td>${studentTaxPaidControl(e,id)}</td>`:""}</tr>`;
  }).join("")}</tbody></table></div>`;
}
function studentTaxDueForLedger(e,id){
  if(!e || !id) return 0;
  if(!isStudentTradeLedger(e)) return 0;
  if(ledgerTaxPaid(e) || obj(obj(e.meta).taxPaidBy)[id]) return 0;
  const income=arr(e.lines)
    .filter(l=>l.account===id && n(l.delta)>0)
    .reduce((sum,l)=>sum+n(l.delta),0);
  return income>0 ? tax(income) : 0;
}
function studentTaxPaidControl(e,id){
  if(!isStudentTradeLedger(e)) return `<span class="small">-</span>`;
  if(ledgerTaxPaid(e) || obj(obj(e.meta).taxPaidBy)[id]) return `<span class="pill green">납부완료</span>`;
  const amount=studentTaxDueForLedger(e,id);
  if(amount<=0) return `<span class="small">해당 없음</span>`;
  return `<button class="orange studentTaxPayBtn" onclick="payMyLedgerTax('${e.id}')">${won(amount)} 납부</button>`;
}
function bankbookLedgerTableHtml(id){
  const rows=studentLedgerEntries(id,9999);
  if(!rows.length) return `<p class="small">최근 거래 내역이 없습니다.</p>`;
  const dates=[...new Set(rows.map(e=>(e.ts||"").slice(0,10)).filter(Boolean))];
  const activeDate=(bankLedgerDateFilter && dates.includes(bankLedgerDateFilter)) ? bankLedgerDateFilter : "";
  const filtered=activeDate ? rows.filter(e=>(e.ts||"").slice(0,10)===activeDate) : rows;
  const totalPages=Math.max(1,Math.ceil(filtered.length/BANK_LEDGER_PAGE_SIZE));
  if(bankLedgerPage>totalPages) bankLedgerPage=totalPages;
  if(bankLedgerPage<1) bankLedgerPage=1;
  const start=(bankLedgerPage-1)*BANK_LEDGER_PAGE_SIZE;
  const pageRows=filtered.slice(start,start+BANK_LEDGER_PAGE_SIZE);
  const options=`<option value="">전체 날짜</option>${dates.map(day=>`<option value="${day}" ${day===activeDate?"selected":""}>${day}</option>`).join("")}`;
  return `<div class="bankbookLedgerControls">
      <label>날짜별 보기</label>
      <select class="bankbookFilterSelect" onchange="setBankLedgerDateFilter(this.value)">${options}</select>
      <span class="small">${filtered.length}건</span>
    </div>
    <div class="bankbookLedger"><table><thead><tr><th>날짜</th><th>내용</th><th class="num">금액</th><th>세금</th></tr></thead><tbody>${pageRows.map(e=>{
      const cls=e.delta>=0?"ledgerPlus":"ledgerMinus";
      const day=e.ts ? seoulDateShortText(e.ts) : "-";
      return `<tr><td>${day}</td><td>${e.desc||e.type||"-"}</td><td class="num ${cls}">${e.delta>=0?"+":""}${won(e.delta)}</td><td>${studentTaxPaidControl(e,id)}</td></tr>`;
    }).join("")}</tbody></table></div>
    <div class="bankbookLedgerPager">
      <button class="bankPagerBtn" onclick="changeBankLedgerPage(-1)" ${bankLedgerPage<=1?"disabled":""}>이전</button>
      <span>${bankLedgerPage} / ${totalPages}</span>
      <button class="bankPagerBtn" onclick="changeBankLedgerPage(1)" ${bankLedgerPage>=totalPages?"disabled":""}>다음</button>
    </div>`;
}
function depositLedgerEntries(id,limit=9999){
  const rows=[];
  arr(data.ledger).forEach(e=>{
    const meta=obj(e.meta);
    const delta=n(meta.depositDelta);
    if(delta!==0 && arr(e.lines).some(l=>l.account===id)){
      rows.push({...e,delta:money(delta),depositKind:delta>0?"입금":"출금"});
    }
    const interest=obj(meta.deposits)[id];
    if(interest){
      rows.push({
        ...e,
        delta:money(interest.interest),
        depositKind:"이자",
        desc:`${e.desc||"예금 이자"} · 잔액 ${won(interest.balance)}`
      });
    }
  });
  rows.sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
  return limit ? rows.slice(0,limit) : rows;
}
function depositLedgerTableHtml(id){
  const rows=depositLedgerEntries(id,9999);
  if(!rows.length) return `<p class="small">예금 거래 내역이 없습니다.</p>`;
  const dates=[...new Set(rows.map(e=>(e.ts||"").slice(0,10)).filter(Boolean))];
  const activeDate=(bankLedgerDateFilter && dates.includes(bankLedgerDateFilter)) ? bankLedgerDateFilter : "";
  const filtered=activeDate ? rows.filter(e=>(e.ts||"").slice(0,10)===activeDate) : rows;
  const totalPages=Math.max(1,Math.ceil(filtered.length/BANK_LEDGER_PAGE_SIZE));
  if(bankLedgerPage>totalPages) bankLedgerPage=totalPages;
  if(bankLedgerPage<1) bankLedgerPage=1;
  const start=(bankLedgerPage-1)*BANK_LEDGER_PAGE_SIZE;
  const pageRows=filtered.slice(start,start+BANK_LEDGER_PAGE_SIZE);
  const options=`<option value="">전체 날짜</option>${dates.map(day=>`<option value="${day}" ${day===activeDate?"selected":""}>${day}</option>`).join("")}`;
  return `<div class="bankbookLedgerControls">
      <label>날짜별 보기</label>
      <select class="bankbookFilterSelect" onchange="setBankLedgerDateFilter(this.value)">${options}</select>
      <span class="small">${filtered.length}건</span>
    </div>
    <div class="bankbookLedger"><table><thead><tr><th>날짜</th><th>구분</th><th>내용</th><th class="num">예금 변동</th></tr></thead><tbody>${pageRows.map(e=>{
      const cls=e.delta>=0?"ledgerPlus":"ledgerMinus";
      const day=e.ts ? seoulDateShortText(e.ts) : "-";
      return `<tr><td>${day}</td><td>${e.depositKind||"-"}</td><td>${e.desc||e.type||"-"}</td><td class="num ${cls}">${e.delta>=0?"+":""}${won(e.delta)}</td></tr>`;
    }).join("")}</tbody></table></div>
    <div class="bankbookLedgerPager">
      <button class="bankPagerBtn" onclick="changeBankLedgerPage(-1)" ${bankLedgerPage<=1?"disabled":""}>이전</button>
      <span>${bankLedgerPage} / ${totalPages}</span>
      <button class="bankPagerBtn" onclick="changeBankLedgerPage(1)" ${bankLedgerPage>=totalPages?"disabled":""}>다음</button>
    </div>`;
}
function pendingTaxDueOf(id){
  return (obj(derived.ledgerByAccount)[id] || []).reduce((sum,e)=>sum+studentTaxDueForLedger(e,id),0);
}
function openBankbookShellHtml(book,leftHtml,rightHtml,footerHtml=""){
  return `<div class="section bankbookDetailPanel bankbookDetail-${book.tone}">
    <div class="head bankbookDetailHead"><div><h2>${book.name}</h2><div class="sub">${book.desc}</div></div><button class="bankbookBackBtn" onclick="setBankbook('')">통장 선택으로</button></div>
    ${bankbookTabsHtml(book.id)}
    <div class="openBankbookPanel">
      <div class="openBankbookPages">
        <div class="bankbookPage left">${leftHtml}</div>
        <div class="bankbookPage right">${rightHtml}</div>
      </div>
    </div>
    ${footerHtml?`<div class="bankbookDetailFooter">${footerHtml}</div>`:""}
  </div>`;
}
function cashBankbookHtml(id){
  const book=bankbookById("cash");
  const left=`<h3>입출금통장</h3><div class="bankbookBigValue"><div class="bankbookBigIcon">🍊</div><span>현재 현금</span><b>${won(balanceOf(id))}</b><em>바로 사용 가능</em></div>
    <div class="bankbookTransferBox"><div class="bankbookTransferIcon">🤝</div><strong>친구 송금</strong><small>친구에게 열매를 바로 보냅니다.</small>
      <div class="bankbookTransferGrid"><select id="bankTransferTo">${studentOptions().replace(`<option value="${id}" ${id===id?"selected":""}>${studentName(id)}${studentJobName(student(id))?` (${studentJobName(student(id))})`:""}</option>`,"")}</select><input id="bankTransferAmount" type="number" min="1" value="10"></div>
      <input id="bankTransferMemo" class="bankbookTransferMemo" placeholder="메모 예: 물건값, 간식값">
      <button class="green bankbookTransferBtn" onclick="bankbookTransfer()">송금하기</button>
    </div>`;
  const right=`<h3>최근 거래 내역</h3>${bankbookLedgerTableHtml(id)}`;
  return openBankbookShellHtml(book,left,right,``);
}
function depositBankbookHtml(id){
  const book=bankbookById("deposit");
  const deposit=n(obj(data.deposits)[id]);
  const rate=savingsRate();
  const left=`<h3>예금통장</h3><div class="bankbookMiniStats"><div><span>현재 예금 잔액</span><b>${won(deposit)}</b></div><div><span>이자율</span><b>${Math.round(rate*100)}%</b></div><div><span>다음 이자 지급일</span><b>교사 지급 시</b></div><div><span>예상 이자액</span><b>${won(deposit*rate)}</b></div></div>
    <div class="bankbookForm"><div class="field"><label>예금 신청 금액</label><input id="reqDepositAmount" type="number" value="100"></div><div class="toolbar"><button class="blue" onclick="requestDepositIn()">예금 입금 신청</button><button class="green" onclick="requestDepositOut()">예금 출금 신청</button></div></div>`;
  const pending=bankRequestHistoryHtml(id,["depositIn","depositOut"]);
  const right=`<h3>예금 거래 내역</h3>${depositLedgerTableHtml(id)}<div style="margin-top:18px"><h3>예금 신청 내역</h3>${pending}</div>`;
  return openBankbookShellHtml(book,left,right);
}
function savingBankbookHtml(id){
  const book=bankbookById("saving");
  const rows=activeSavings(id);
  const next=rows[0] ? savingNextPayDate(rows[0]) : "-";
  const expected=rows.reduce((sum,s)=>sum+Math.max(0,savingProjection(s).balance-n(s.totalPaid||0)),0);
  const left=`<h3>적금통장</h3><div class="bankbookMiniStats"><div><span>현재 적금 평가액</span><b>${won(savingsValueOf(id))}</b></div><div><span>납입 주기</span><b>${SAVING_PAYMENT_INTERVAL_DAYS}일마다</b></div><div><span>다음 납입일</span><b>${next}</b></div><div><span>예상 이자액</span><b>${won(expected)}</b></div></div>
    <div class="bankbookForm"><div class="field"><label>${SAVING_PAYMENT_INTERVAL_DAYS}일마다 납입할 금액</label><input id="reqSavingAmount" type="number" value="100"></div><div class="field"><label>기간</label><select id="reqSavingDays"><option value="21">3주</option><option value="28">4주</option><option value="35">5주</option></select></div><button class="orange" onclick="requestSavingStart()">적금 개설 신청</button></div>`;
  const right=`<h3>납입 기록</h3>${savingsRowsHtml(id)}`;
  return openBankbookShellHtml(book,left,right);
}
function investmentBankbookHtml(id){
  const book=bankbookById("investment");
  const hold=obj(obj(data.ticketHoldings)[id]);
  const ticketRows=Object.keys(ticketMeta).filter(k=>n(hold[k])>0);
  const ticketTable=ticketRows.length ? `<div class="scroll"><table><thead><tr><th>티켓</th><th class="num">수량</th><th class="num">현재가</th><th class="num">평가금액</th></tr></thead><tbody>${ticketRows.map(k=>`<tr><td>${ticketMeta[k].name}</td><td class="num">${n(hold[k])}</td><td class="num">${won(ticketSell(k))}</td><td class="num"><b>${won(n(hold[k])*ticketSell(k))}</b></td></tr>`).join("")}</tbody></table></div>` : `<p class="small">보유 티켓이 없습니다.</p>`;
  const total=ticketValueOf(id)+bondCurrentValueOf(id);
  const left=`<h3>투자통장</h3><div class="bankbookMiniStats"><div><span>보유 티켓 평가액</span><b>${won(ticketValueOf(id))}</b></div><div><span>채권 평가금액</span><b>${won(bondCurrentValueOf(id))}</b></div><div><span>투자 평가금액</span><b>${won(total)}</b></div><div><span>실현손익</span><b>거래 완료 기준</b></div></div><h3>보유 티켓</h3>${ticketTable}`;
  const right=`<h3>보유 채권</h3>${activeBondRowsHtml(id)}<div class="small">평가손익은 현재 보유 자산 기준, 실현손익은 매도·만기 처리 후 거래내역에서 구분됩니다.</div>`;
  return openBankbookShellHtml(book,left,right);
}
function loanBankbookHtml(id){
  const book=bankbookById("loan");
  const limit=loanLimitInfo(id);
  const loans=activeLoans(id);
  const next=loans[0]?.due || "-";
  const nextPay=loans[0] ? money(n(loans[0].amount)*(1+n(loans[0].rate)/100)) : 0;
  const overdue=loans.some(l=>new Date((l.due||"")+"T00:00:00")<new Date(today()+"T00:00:00"));
  const left=`<h3>대출통장</h3><div class="bankbookMiniStats"><div><span>대출 잔액</span><b>${won(limit.debt)}</b></div><div><span>대출 한도</span><b>${won(limit.gross)}</b></div><div><span>남은 대출 가능액</span><b>${won(limit.available)}</b></div><div><span>이자율</span><b>${suggestedLoanRate(id)}%</b></div><div><span>다음 상환일</span><b>${next}</b></div><div><span>다음 상환 예정액</span><b>${won(nextPay)}</b></div><div><span>연체 여부</span><b>${overdue?"연체":"정상"}</b></div><div><span>신용도</span><b>${creditScoreInfo(id).grade}</b></div></div>
    ${loanLimitCardHtml(id)}<div class="bankbookForm"><div class="field"><label>신청 금액</label><input id="reqLoanAmount" type="number" value="${Math.min(100,limit.available)||0}" max="${limit.available}"></div><div class="field"><label>사용 목적</label><input id="reqLoanPurpose" placeholder="예: 투자 자금, 사업 준비"></div><button class="purple" onclick="requestLoanApply()">대출 신청</button></div>`;
  const right=`<h3>대출 상환</h3>${creditScorePill(id)}${loanRowsHtml(id)}`;
  return openBankbookShellHtml(book,left,right);
}
function bankbookDetailHtml(id,active){
  if(active==="deposit") return depositBankbookHtml(id);
  if(active==="saving") return savingBankbookHtml(id);
  if(active==="investment") return investmentBankbookHtml(id);
  if(active==="loan") return loanBankbookHtml(id);
  return cashBankbookHtml(id);
}
function bankStudentHtml(id){
  const valid=bankbookTypes().some(b=>b.id===selectedBankbook);
  const active=valid ? selectedBankbook : "";
  return `<div class="financePage bankPage">
    <div class="section bankHero">
      <div class="head"><div><h2>은행</h2><div class="sub">예금, 적금, 대출을 관리합니다.</div></div><div>${currentAssetPill(id)}</div></div>
      ${bankSummaryCardsHtml(id)}
    </div>
    ${active ? bankbookDetailHtml(id,active) : bankbookSelectHtml(id)}
  </div>`;
}
function financeStudentHtml(id){
  if(isMobileViewport()){
    const pages={
      cash:["입출금",cashBankbookHtml(id)],
      deposit:["예금",depositBankbookHtml(id)],
      saving:["적금",savingBankbookHtml(id)],
      investment:["투자",investmentBankbookHtml(id)],
      loan:["대출",loanBankbookHtml(id)]
    };
    if(activeMobilePage && pages[activeMobilePage]) return `${mobileSubPageHeader(pages[activeMobilePage][0])}${pages[activeMobilePage][1]}`;
    return `<div class="section"><div class="head"><div><h2>통장</h2><div class="sub">입출금, 예금, 적금, 투자, 대출만 나눠 봅니다.</div></div></div>${mobileMenuGrid([
      {id:"cash",icon:"account_balance_wallet",title:"입출금",description:"현금, 송금, 최근 거래 내역",badge:won(balanceOf(id))},
      {id:"deposit",icon:"savings",title:"예금",description:"예금 입금·출금 신청",badge:won(obj(data.deposits)[id]||0)},
      {id:"saving",icon:"trending_up",title:"적금",description:"정기 납입과 만기 확인",badge:won(savingsValueOf(id))},
      {id:"investment",icon:"query_stats",title:"투자",description:"티켓과 채권 평가금액",badge:won(ticketValueOf(id)+bondCurrentValueOf(id))},
      {id:"loan",icon:"credit_score",title:"대출",description:"대출 한도와 상환 관리",badge:won(activeLoanBalance(id))}
    ])}</div>`;
  }
  return bankStudentHtml(id);
}

window.setBankbook = function(id=""){
  selectedBankbook = id;
  bankLedgerDateFilter = "";
  bankLedgerPage = 1;
  render();
}
window.setBankLedgerDateFilter = function(value=""){
  bankLedgerDateFilter = value || "";
  bankLedgerPage = 1;
  render();
}
window.changeBankLedgerPage = function(delta=0){
  bankLedgerPage = Math.max(1, bankLedgerPage + Number(delta||0));
  render();
}
window.payFirstPendingTax = async function(){
  const id=selectedStudent;
  const target=(obj(derived.ledgerByAccount)[id] || []).find(e=>studentTaxDueForLedger(e,id)>0);
  if(!target) return toast("납부할 세금이 없습니다.");
  await window.payMyLedgerTax(target.id);
}
window.bankbookTransfer = async function(){
  const to=document.getElementById("bankTransferTo")?.value || "";
  const amount=n(document.getElementById("bankTransferAmount")?.value);
  const memo=(document.getElementById("bankTransferMemo")?.value || "친구 송금").trim() || "친구 송금";
  if(!selectedStudent) return toast("학생 선택이 필요합니다.");
  if(!to) return toast("받는 친구를 선택하세요.");
  if(to===selectedStudent) return toast("나에게는 송금할 수 없습니다.");
  if(amount<=0) return toast("송금액을 입력하세요.");
  if(await doTransfer(selectedStudent,to,amount,memo)) toast("송금 완료");
}

function studentSettingsHtml(id){
  const s=student(id);
  return `<div class="settingsStudentPage">
    <div class="section"><div class="head"><div><h2>설정</h2><div class="sub">학생 정보, 신청 내역, 거래내역을 확인합니다.</div></div><button onclick="studentLogout()">로그아웃</button></div>
      <div class="studentProfilePanel"><div>${avatarPreviewHtml(id)}</div><div><h3>${s?.name||"학생"}</h3><p class="small">재산 ${rankOfStudent(id)}위 · ${studentJobName(s)||"직업 없음"}</p><p class="small">교사용 화면 전환은 설정 안에서만 보이도록 정리했습니다.</p></div></div>
      <div class="settingsActionRow"><button class="settingsTeacherAccessBtn" onclick="askTeacherPassword()">${materialIcon('admin_panel_settings','msIcon')} 교사용 화면</button></div>
    </div>
    <div class="section"><div class="head"><div><h2>빠른 신청</h2><div class="sub">자주 쓰는 송금, 예금, 채권 신청입니다.</div></div></div>${studentQuickActionsHtml(id)}</div>
    <div class="section"><div class="head"><div><h2>내 신청 내역</h2><div class="sub">대기 중인 신청을 취소할 수 있습니다.</div></div></div>${myRequests(id)}</div>
    <div class="section"><div class="head"><div><h2>전체 거래내역</h2><div class="sub">모든 학생의 입금, 송금, 구매, 세금 기록을 같이 확인합니다.</div></div></div>${allStudentLedgerHtml()}</div>
  </div>`;
}
function firstProductPublicPrice(){ const p=arr(data.products)[0]; return p ? (publicPrice(p) ?? money(productPrice(p))) : 10; }
function visitHtml(){
  if(isMobileViewport() && activeMobilePage && activeMobilePage.startsWith("peer_")){
    return mobileRankStudentHomeHtml(activeMobilePage.slice(5));
  }
  return `<div class="visitPage">
    <div class="section fullRankSection friendRankSectionV125"><div class="head"><div><h2>친구 현황</h2><div class="sub">카카오톡 친구 목록처럼 프로필, 이름, 상태메시지를 순위 순서로 봅니다.</div></div></div>${friendStatusListHtml({mobile:isMobileViewport()})}</div>
    <div class="section fullRankSection"><div class="head"><div><h2>개인 재산 순위</h2><div class="sub">학생을 누르면 그 학생의 홈 화면을 볼 수 있습니다.</div></div></div>${assetRankingTableHtml()}</div>
    <div class="section fullRankSection"><div class="head"><div><h2>법인 재산 순위</h2><div class="sub">등록된 법인의 순자산과 공식 주가 기준입니다.</div></div></div>${corporationRankingTableHtml()}</div>
    <div class="section"><div class="head"><div><h2>오늘의 거래 순위표</h2><div class="sub">세금 납부 표시가 된 학생 간 거래만 집계합니다.</div></div></div>${tradeKingTableHtml()}</div>
  </div>`;
}
function marketSignal(){
  const rows=economyHistoryRows(2);
  const diff=rows.length>=2 ? n(rows[rows.length-1].totalHoldings)-n(rows[rows.length-2].totalHoldings) : 0;
  return diff>0?"상승":diff<0?"하락":"안정";
}
function marketHelp(){
  const rows=economyHistoryRows(2);
  const diff=rows.length>=2 ? n(rows[rows.length-1].totalHoldings)-n(rows[rows.length-2].totalHoldings) : 0;
  return diff>0?`전날보다 ${won(diff)} 많음`:diff<0?`전날보다 ${won(Math.abs(diff))} 적음`:"전날과 비슷함";
}
function currentHistorySnapshot(){
  const stats=currentEconomyStats(today());
  const current={id:"now",at:now(),iso:new Date().toISOString(),previousIncome:n(data.previousIncome),todayIncome:todayY(),economyStats:stats,tickets:{},products:{}};
  Object.keys(ticketMeta).forEach(k=>{
    const info=stats.ticketPrices[k] || ticketPriceInfo(k);
    current.tickets[k]={base:info.base,buy:info.close,sell:info.close,open:info.open,close:info.close,high:info.high,low:info.low,change:info.change,changeRate:info.changeRate,buyOrders:info.buyOrders,sellOrders:info.sellOrders};
  });
  arr(data.products).forEach(p=>current.products[p.id]={price:money(productPrice(p)),publicPrice:publicPrice(p)});
  return current;
}
function fullHistoryWithNow(){
  return arr(data.history).sort((a,b)=>(a.iso||"").localeCompare(b.iso||"")).concat([currentHistorySnapshot()]);
}
function economyStatsFromHistorySnapshot(x){
  const stats=obj(x.economyStats || x.dailyEconomyStats);
  const day=String(stats.date || (x.iso||"").slice(0,10) || x.day || "").slice(0,10);
  if(!day || !stats || typeof stats!=="object" || !n(stats.totalHoldings)) return null;
  return {
    day,
    totalHoldings:money(stats.totalHoldings),
    liquidHoldings:money(stats.liquidHoldings),
    lockedHoldings:money(stats.lockedHoldings),
    issuedIncome:money(stats.issuedIncome ?? stats.issuedIncomeToday),
    burnedAmount:money(stats.burnedAmount ?? stats.burnedAmountToday),
    netChange:money(stats.netChange),
    averageHoldingPerStudent:money(stats.averageHoldingPerStudent),
    ticketPrices:obj(stats.ticketPrices)
  };
}
function economyHistoryRows(limit=14, includeNow=true){
  const days={};
  Object.entries(obj(data.dailyEconomyStats)).forEach(([key,value])=>{
    const r=economyStatsFromHistorySnapshot({day:key,economyStats:{date:key,...obj(value)}});
    if(r) days[r.day]=r;
  });
  arr(data.history).forEach(x=>{
    const r=economyStatsFromHistorySnapshot(x);
    if(r) days[r.day]=r;
  });
  if(includeNow){
    const nowStats=currentEconomyStats(today());
    days[today()]={day:today(),...nowStats};
  }
  const rows=Object.values(days).sort((a,b)=>a.day.localeCompare(b.day));
  return limit ? rows.slice(-limit) : rows;
}
function totalHoldingsLineChartHtml(limit=14){
  const rows=economyHistoryRows(limit);
  if(!rows.length) return `<p class="small">전체 열매 보유량 기록이 아직 없습니다.</p>`;
  const W=900,H=380,pad={l:92,r:34,t:30,b:70};
  const vals=rows.map(r=>n(r.totalHoldings));
  let min=Math.min(...vals), max=Math.max(...vals);
  if(max===min){max+=1; min=Math.max(0,min-1);}
  const extra=(max-min)*0.12 || 1; min=Math.max(0,min-extra); max+=extra;
  const range=max-min;
  const x=i=>pad.l+(W-pad.l-pad.r)*(rows.length===1?0.5:i/(rows.length-1));
  const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  const grid=[0,1,2,3,4].map(i=>{
    const yy=pad.t+(H-pad.t-pad.b)*i/4;
    const val=max-range*i/4;
    return `<line x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}" stroke="#e2e8f0"/><text x="${pad.l-10}" y="${yy+4}" text-anchor="end" font-size="12" fill="#64748b">${Math.round(val).toLocaleString("ko-KR")}</text>`;
  }).join("");
  const points=rows.map((r,i)=>`${x(i)},${y(r.totalHoldings)}`).join(" ");
  const area=`${pad.l},${H-pad.b} ${points} ${x(rows.length-1)},${H-pad.b}`;
  const labels=rows.map((r,i)=>`<text x="${x(i)}" y="${H-20}" text-anchor="middle" font-size="12" fill="#64748b">${r.day.slice(5).replace("-","/")}</text>`).join("");
  const dots=rows.map((r,i)=>{
    const prev=rows[i-1];
    const diff=prev ? n(r.totalHoldings)-n(prev.totalHoldings) : 0;
    const rate=prev && n(prev.totalHoldings)>0 ? diff/n(prev.totalHoldings)*100 : 0;
    return `<circle cx="${x(i)}" cy="${y(r.totalHoldings)}" r="6" fill="#2563eb"><title>${r.day}\n전체 열매: ${won(r.totalHoldings)}\n전날 대비: ${signedWon(diff)}\n등락률: ${pct(rate)}</title></circle>`;
  }).join("");
  return `<div class="incomeLineChart holdingsLineChart clickableChart" onclick="showTotalIncomeChart()" title="전체 날짜 차트 보기"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<polygon points="${area}" fill="#dbeafe" opacity=".72"/><polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg><div class="small">최근 ${rows.length}일 전체 열매 보유량입니다. 클릭하면 전체 날짜를 봅니다.</div></div>`;
}
function totalIncomeLineChartHtml(limit=14){ return totalHoldingsLineChartHtml(limit); }

async function addLedger(type, desc, lines, meta={}){
  const id = txid();
  const entry = {id, ts:seoulIsoString(), day:today(), type, desc, lines:lines.map(l=>({account:l.account,delta:money(l.delta)})), meta};
  await dbSet("ledger/" + id, entry);
  return id;
}
async function updateFields(fields){ await dbUpdate("", fields); }

onValue(rootRef, async (snap)=>{
  try{
    firebaseReady = true; window.__ECONOMY_FIREBASE_READY__ = true;
    const val = snap.val();
    if(!val){
      data = structuredClone(defaultData);
      rebuildDerivedState();
      document.getElementById("status").innerHTML = `<b>Firebase 연결됨</b> <span class="pill orange">초기 데이터 생성 중</span>`;
      scheduleRender(0);
      try{
        await set(rootRef, defaultData);
        document.getElementById("status").innerHTML = `<b>Firebase 연결됨</b> <span class="pill green">기본 데이터 생성 완료</span>`;
      }catch(writeErr){
        document.getElementById("status").innerHTML = `<b>Firebase 쓰기 실패</b><div class="sub">${writeErr.message}</div><p class="small">Realtime Database 규칙에서 .write 권한을 확인하세요. 현재 화면은 임시 기본 데이터입니다.</p>`;
      }
      return;
    }
    data = mergeDefaults(defaultData, val);
    rebuildDerivedState();
    repairSnackProductDefaultsIfNeeded();
    document.getElementById("status").innerHTML = `<b>Firebase 연결됨</b> <span class="pill green">실시간 동기화 중</span>`;
    if(uiEditing){
      pendingRealtimeRender = true;
      return;
    }
    scheduleRender();
  }catch(e){
    console.error("Firebase callback error", e);
    document.getElementById("status").innerHTML = `<b>Firebase 데이터 처리 오류</b><div class="sub">${e.message}</div><p class="small">저장된 데이터 구조가 꼬였을 수 있습니다. 설정 탭의 티켓 구조 복구 또는 전체 초기화를 사용하세요.</p>`;
    try{ data=mergeDefaults(defaultData, snap.val()||{}); rebuildDerivedState(); scheduleRender(); }catch(_){}
  }
}, (err)=>{
  firebaseReady = true; window.__ECONOMY_FIREBASE_READY__ = true;
  document.getElementById("status").innerHTML = `<b>Firebase 연결 실패</b><div class="sub">${err.message}</div><p class="small">Realtime Database를 만들고 테스트 모드 규칙을 켰는지 확인하세요.</p>`;
});

function setMode(m){mode=m; localStorage.setItem("economyMode",m); render();}
function teacherTabCatalog(){
  return [
    {id:"dashboard",name:"홈",desktopName:"대시보드",icon:"dashboard"},
    {id:"students",name:"학생",desktopName:"학생·잔고",icon:"groups"},
    {id:"transactions",name:"경제",desktopName:"송금·지급·벌금",icon:"payments"},
    {id:"jobs",name:"직업",desktopName:"직업·임금",icon:"work"},
    {id:"shop",name:"상점",desktopName:"상품·상점",icon:"storefront"},
    {id:"industry",name:"산업",desktopName:"산업",icon:"factory"},
    {id:"corporations",name:"법인",desktopName:"법인·주식",icon:"domain"},
    {id:"tickets",name:"티켓",desktopName:"티켓시장",icon:"confirmation_number"},
    {id:"finance",name:"금융",desktopName:"예금·채권",icon:"savings"},
    {id:"noticeboard",name:"알림",desktopName:"알림장",icon:"notifications"},
    {id:"ledger",name:"장부",desktopName:"거래장부",icon:"receipt_long"},
    {id:"settings",name:"설정",desktopName:"설정",icon:"settings"},
    {id:"teacherMore",name:"메뉴",desktopName:"메뉴",icon:"menu"}
  ];
}
function mobileTeacherPrimaryIds(){return ["dashboard","students","transactions","noticeboard","teacherMore"]}
function teacherVisibleTab(active=currentTab){
  if(!isMobileViewport()) return active;
  return mobileTeacherPrimaryIds().includes(active) ? active : "teacherMore";
}
function teacherNavBadgeCount(id){
  if(id==="noticeboard") return teacherUnreadMessages()+todayUncheckedNoticeCount();
  if(id==="transactions") return arr(data.requests).length;
  return 0;
}
function ensureTeacherMoreSection(){
  const view=document.getElementById("teacherView");
  if(view && !document.getElementById("teacherMore")){
    const sec=document.createElement("section");
    sec.id="teacherMore";
    sec.className="tabPage hidden";
    view.appendChild(sec);
  }
}
function teacherTabsHtml(active=currentTab){
  const visible=teacherVisibleTab(active);
  const tabs=teacherTabCatalog().filter(t=>{
    if(isMobileViewport()) return mobileTeacherPrimaryIds().includes(t.id);
    return t.id!=="teacherMore";
  });
  return tabs.map(t=>{
    const badge=teacherNavBadgeCount(t.id);
    const label=isMobileViewport()?t.name:(t.desktopName||t.name);
    return `<button class="${visible===t.id?'active':''}" data-tab="${t.id}" onclick="setTab('${t.id}')">${materialIcon(t.icon,'teacherTabIcon msIcon')}<span class="tabLabel">${label}</span>${badge>0?`<span class="navBadge">${badge>99?"99+":badge}</span>`:""}</button>`;
  }).join("");
}
function switchToStudentMode(){
  mode="student";
  localStorage.setItem("economyMode","student");
  activeMobileTeacherPage="";
  localStorage.removeItem("activeMobileTeacherPage");
  render();
  toast("학생용 화면으로 전환");
}
function switchToTeacherMode(){
  askTeacherPassword();
}
function setTab(tab){
  currentTab=tab;
  activeMobileTeacherPage="";
  localStorage.removeItem("activeMobileTeacherPage");
  document.querySelectorAll(".tabPage").forEach(p=>p.classList.add("hidden"));
  document.getElementById(tab)?.classList.remove("hidden");
  document.querySelectorAll("#teacherTabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(mode==="teacher") renderTeacherTab(tab);
}
function renderTeacherMore(){
  ensureTeacherMoreSection();
  const activeBonds=arr(data.bonds).filter(b=>b.status==="active").length;
  const pending=arr(data.requests).length;
  const unread=teacherUnreadMessages();
  document.getElementById("teacherMore").innerHTML = `<div class="section teacherMobileMenuSection"><div class="head"><div><h2>교사용 메뉴</h2><div class="sub">자주 쓰는 기능은 아래 메뉴에서 바로 들어갑니다.</div></div><button class="green" onclick="switchToStudentMode()">학생용 전환</button></div>
    ${mobileMenuGrid([
      {id:"jobs",icon:"work",title:"직업·임금",description:"직업 등록, 임금표, 성과급 심사",onClick:"setTab('jobs')"},
      {id:"shop",icon:"storefront",title:"상품·상점",description:"상점, 티켓, 자유시장, 승인 관리",onClick:"setTab('shop')"},
      {id:"industry",icon:"factory",title:"산업",description:"재료, 완제품, 산업 재고 관리",onClick:"setTab('industry')"},
      {id:"corporations",icon:"domain",title:"법인·주식",description:"법인 계좌, 지분, 주가 관리",onClick:"setTab('corporations')"},
      {id:"tickets",icon:"confirmation_number",title:"티켓시장",description:"티켓 가격, 재고, 구매/판매 처리",onClick:"setTab('tickets')"},
      {id:"finance",icon:"savings",title:"예금·채권",description:"예금, 적금, 채권, 금리 관리",badge:`채권 ${activeBonds}`,onClick:"setTab('finance')"},
      {id:"ledger",icon:"receipt_long",title:"거래장부",description:"전체 거래 내역 확인",onClick:"setTab('ledger')"},
      {id:"settings",icon:"settings",title:"설정",description:"학생용 탭, 데이터, 시스템 설정",onClick:"setTab('settings')"},
      {id:"student",icon:"person",title:"학생용 화면",description:"학생 화면으로 돌아가기",onClick:"switchToStudentMode()"}
    ])}
    <div class="teacherMobileQuickStats"><span>대기 신청 ${pending}개</span><span>미읽음 ${unread}개</span><span>학생 ${students().length}명</span></div>
  </div>`;
}
const teacherRenderers={
  dashboard:["대시보드",renderDashboard],
  students:["학생·잔고",renderStudentsPage],
  transactions:["송금·지급·벌금",renderTransactions],
  jobs:["직업·임금",renderJobs],
  shop:["상품·상점",renderShop],
  industry:["산업",renderIndustryTeacher],
  corporations:["법인·주식",renderCorporations],
  tickets:["티켓시장",renderTickets],
  finance:["예금·채권",renderFinance],
  noticeboard:["알림장",renderNoticeboardTeacher],
  ledger:["거래장부",renderLedger],
  settings:["설정",renderSettings],
  teacherMore:["교사용 메뉴",renderTeacherMore]
};
function renderTeacherTab(tab=currentTab){
  const item=teacherRenderers[tab] || teacherRenderers.dashboard;
  safeRender(item[0],item[1]);
}
function safeRender(name, fn){
  try { fn(); }
  catch(e){
    console.error("render error:", name, e);
    const statusEl=document.getElementById("status");
    if(statusEl) statusEl.innerHTML = `<b>화면 렌더링 오류</b><div class="sub">${name}: ${e.message}</div>`;
  }
}
function render(){
  const teacherTabsEl=document.getElementById("teacherTabs"), teacherViewEl=document.getElementById("teacherView"), studentViewEl=document.getElementById("studentView");
  if(!teacherTabsEl || !teacherViewEl || !studentViewEl) return showStartupError("HTML 구조 오류","필수 화면 영역을 찾지 못했습니다.");
  if(mode==="teacher" && !teacherUnlocked){
    mode="student";
    localStorage.setItem("economyMode","student");
  }
  document.body.dataset.mode=mode;
  document.body.dataset.studentTab=studentTab;
  ensureNoticeSubscriptions();
  ensureTeacherMoreSection();
  if(mode==="teacher") teacherTabsEl.innerHTML=teacherTabsHtml(currentTab);
  teacherTabsEl.classList.toggle("hidden",mode!=="teacher");
  teacherViewEl.classList.toggle("hidden",mode!=="teacher");
  studentViewEl.classList.toggle("hidden",mode!=="student");
  if(mode==="teacher"){
    renderTeacherTab(currentTab);
    document.querySelectorAll(".tabPage").forEach(p=>p.classList.add("hidden"));
    document.getElementById(currentTab)?.classList.remove("hidden");
    document.querySelectorAll("#teacherTabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===teacherVisibleTab(currentTab)));
  }else{
    safeRender("학생화면", renderStudentView);
  }
}


function oldRequests(hours=24){
  const cutoff=Date.now()-hours*60*60*1000;
  return arr(data.requests).filter(r=>new Date(r.ts||0).getTime()<cutoff);
}
function oldRequestNoticeHtml(){
  const old=oldRequests(24);
  return old.length?`<div class="expireNotice"><b>오래된 신청 ${old.length}개</b>가 있습니다. 24시간이 지난 신청은 현재 잔고/재고와 맞지 않을 수 있으니 정리하는 것을 권장합니다.</div>`:"";
}
function economyIndexCardHtml(){
  const rows=economyHistoryRows(2);
  const stats=currentEconomyStats(today());
  const prev=rows.length>=2 ? rows[rows.length-2] : null;
  const diff=prev ? n(stats.totalHoldings)-n(prev.totalHoldings) : 0;
  const rate=prev && n(prev.totalHoldings)>0 ? diff/n(prev.totalHoldings)*100 : 0;
  const trendClass=diff>=0?"up":"down";
  return `<div class="economyIndexGrid">
    <div class="economyIndexHero ${trendClass}">
      <div class="economyIndexLabel">우리 반 경제지수</div>
      <div class="economyIndexValue">${won(stats.totalHoldings)}</div>
      <div class="economyIndexDelta"><b>${diff>=0?"▲":"▼"} ${signedWon(diff)}</b><span>${pct(rate)}</span></div>
      <button class="helpBtn" onclick="showEconomyHelp()">도움말</button>
    </div>
    <div class="economyMiniStats">
      <div class="stat blue"><div class="label">바로 쓸 수 있는 열매</div><div class="value">${won(stats.liquidHoldings)}</div><div class="help">지갑 + 단체 현금</div></div>
      <div class="stat purple"><div class="label">묶여 있는 열매</div><div class="value">${won(stats.lockedHoldings)}</div><div class="help">예금 + 적금 + 채권</div></div>
      <div class="stat green"><div class="label">오늘 새로 풀린 열매</div><div class="value">${won(stats.issuedIncome)}</div><div class="help">지급·임금·이자</div></div>
      <div class="stat red"><div class="label">오늘 사라진 열매</div><div class="value">${won(stats.burnedAmount)}</div><div class="help">세금·벌금·구매</div></div>
    </div>
  </div>`;
}
function economyChartPanelHtml(){
  return `<div class="section economyChartSection">
    <div class="head"><div><h2>전체 열매 보유량 변화</h2><div class="sub">총소득 대신 우리 반 전체가 가진 열매 총합을 추적합니다.</div></div><div class="toolbar"><button onclick="showTotalIncomeChart(7)">7일</button><button class="blue" onclick="showTotalIncomeChart(14)">14일</button><button onclick="showTotalIncomeChart(30)">30일</button></div></div>
    ${totalHoldingsLineChartHtml(14)}
  </div>`;
}

function renderDashboard(){
  const totalCash=students().reduce((a,s)=>a+balanceOf(s.id),0);
  const totalDeposit=Object.values(obj(data.deposits)).reduce((a,b)=>a+n(b),0);
  const activeBonds=arr(data.bonds).filter(b=>b.status==="active");
  if(isMobileViewport()){
    document.getElementById("dashboard").innerHTML = `
      <div class="section"><div class="head"><div><h2>교사 대시보드</h2><div class="sub">오늘 확인할 요약만 먼저 보여줍니다.</div></div></div>
        <div class="grid g2">
          <div class="stat blue"><div class="label">학생</div><div class="value">${students().length}명</div></div>
          <div class="stat green"><div class="label">현금 합계</div><div class="value">${won(totalCash)}</div></div>
          <div class="stat red"><div class="label">오늘 미체크</div><div class="value">${todayUncheckedNoticeCount()}명</div></div>
          <div class="stat orange"><div class="label">읽지 않은 메시지</div><div class="value">${teacherUnreadMessages()}개</div></div>
        </div>
      </div>
      <div class="section"><div class="head"><div><h2>관리 메뉴</h2><div class="sub">상세 관리는 메뉴로 들어가서 처리합니다.</div></div></div>${mobileMenuGrid([
        {id:"students",icon:"groups",title:"학생관리",description:"학생 목록, 잔액, 직업, 신용도",badge:`${students().length}명`,onClick:"setTab('students')"},
        {id:"transactions",icon:"payments",title:"경제관리",description:"임금 지급, 거래, 벌금, 세금",badge:`신청 ${arr(data.requests).length}`,onClick:"setTab('transactions')"},
        {id:"shop",icon:"storefront",title:"상점/시장",description:"상품, 티켓, 도매, 구매 승인",onClick:"setTab('shop')"},
        {id:"finance",icon:"savings",title:"예금 관리",description:"예금, 적금, 채권 관리",badge:`채권 ${activeBonds.length}`,onClick:"setTab('finance')"},
        {id:"noticeboard",icon:"notifications",title:"알림장",description:"알림, 체크 현황, 메시지함",badge:`미읽음 ${teacherUnreadMessages()}`,onClick:"setTab('noticeboard')"},
        {id:"teacherMore",icon:"menu",title:"더보기",description:"금융, 법인, 장부, 설정 전체 메뉴",onClick:"setTab('teacherMore')"}
      ])}</div>`;
    return;
  }
  document.getElementById("dashboard").innerHTML = `
    <div class="section">
      <div class="head"><div><h2>경제 현황판</h2><div class="sub">대표 지표를 총소득이 아니라 전체 열매 보유량으로 봅니다.</div></div><span class="pill blue">전체 보유량 기준</span></div>
      ${economyIndexCardHtml()}
      <div class="toolbar">
        <button class="primary" onclick="applyTodayAsPrevious()">오늘 경제기록 저장</button>
        <button class="blue" onclick="recordSnapshot()">가격 기록 저장</button>
        <button class="orange" onclick="cleanOldRequests()">오래된 신청 정리</button>
      </div>
      ${oldRequestNoticeHtml()}
    </div>
    ${economyChartPanelHtml()}
    <div class="section">
      <div class="grid g4">
        <div class="stat blue"><div class="label">학생 수</div><div class="value">${students().length}명</div></div>
        <div class="stat green"><div class="label">현금 합계</div><div class="value">${won(totalCash)}</div></div>
        <div class="stat purple"><div class="label">예금 합계</div><div class="value">${won(totalDeposit)}</div></div>
        <div class="stat orange"><div class="label">활성 채권</div><div class="value">${activeBonds.length}개</div></div>
        <div class="stat red"><div class="label">알림 미체크</div><div class="value">${todayUncheckedNoticeCount()}명</div></div>
        <div class="stat blue"><div class="label">읽지 않은 메시지</div><div class="value">${teacherUnreadMessages()}개</div></div>
      </div>
    </div>
    <div class="section"><div class="head"><div><h2>재산 순위표</h2><div class="sub">현금+예금+채권+상품+티켓+법인주식 기준입니다.</div></div></div>${assetRankingTableHtml()}</div>
    <div class="section"><div class="head"><div><h2>오늘 거래왕</h2><div class="sub">세금 납부/거래 인정된 학생 간 거래 기준입니다.</div></div></div>${tradeKingTableHtml()}</div>
    <div class="section"><div class="head"><div><h2>승인 대기 신청</h2><div class="sub">학생이 올린 신청입니다.</div></div></div>${requestTable()}</div>
  `;
}

function requestTable(){
  const reqs=arr(data.requests).sort((a,b)=>(a.ts||"").localeCompare(b.ts||""));
  if(!reqs.length) return `<p class="small">대기 중인 신청이 없습니다.</p>`;
  const order=[
    ["transfer","송금 신청"],
    ["retailBuy","상품 구매 신청"],
    ["ticketBuy","티켓 구매 신청"],
    ["ticketSell","티켓 판매 신청"],
    ["ticketUse","티켓 사용 신청"],
    ["bondBuy","채권 구매 신청"],
    ["depositIn","예금 입금 신청"],
    ["depositOut","예금 출금 신청"]
  ];
  const grouped={};
  reqs.forEach(r=>{const k=r.type||"기타"; if(!grouped[k]) grouped[k]=[]; grouped[k].push(r);});
  const known=order.filter(([k])=>grouped[k]?.length);
  const extra=Object.keys(grouped).filter(k=>!order.some(([x])=>x===k)).map(k=>[k,requestTypeName(k)]);
  const groups=[...known,...extra];
  return `<div class="requestGroupGrid">${groups.map(([type,title])=>requestGroupCard(type,title,grouped[type]||[])).join("")}</div>`;
}
function requestGroupCard(type,title,rows){
  return `<div class="requestGroupCard">
    <div class="head"><div><h3>${title}</h3><div class="sub">${requestGroupHelp(type)}</div></div><span class="requestCount">${rows.length}</span></div>
    ${rows.map(r=>requestLineHtml(r)).join("")}
  </div>`;
}
function requestLineHtml(r){
  return `<div class="requestLine">
    <div class="requestLineTop"><b>${studentName(r.studentId)}</b><span class="small">${seoulDateTimeText(r.ts)}</span></div>
    <div>${requestDesc(r)}</div>
    <div class="actions"><button class="green" onclick="approveRequest('${r.id}')">승인</button><button class="danger" onclick="rejectRequest('${r.id}')">거절</button></div>
  </div>`;
}
function requestGroupHelp(type){
  return {
    transfer:"학생 간 송금입니다. 송금세는 없습니다.",
    retailBuy:"학생 간 상품 구매 신청입니다.",
    ticketBuy:"교사 보유 티켓 재고에서 구매합니다.",
    ticketSell:"학생 보유 티켓을 판매합니다.",
    ticketUse:"티켓을 사용하고 재고로 되돌립니다. 환급 없음.",
    bondBuy:"채권 구매 신청입니다.",
    savingsStart:"적금 가입 신청입니다.",
    loanApply:"은행장이 금리를 정해 승인하는 대출 신청입니다.",
    depositIn:"현금을 예금으로 이동합니다.",
    depositOut:"예금을 현금으로 출금합니다."
  }[type] || "";
}
function requestTypeName(t){return {transfer:"송금",retailBuy:"상품구매",ticketBuy:"티켓구매",ticketSell:"티켓판매",ticketUse:"티켓사용",bondBuy:"채권구매",depositIn:"예금입금",depositOut:"예금출금",savingsStart:"적금가입",loanApply:"대출신청"}[t]||t}
function requestDesc(r){
  if(r.type==="transfer") return `${studentName(r.to)}에게 ${won(r.amount)} 송금`;
  if(r.type==="retailBuy") return `${studentName(r.seller)}에게 ${product(r.productId)?.name||"상품"} ${r.qty}개 구매, 개당 ${won(r.unitPrice)}`;
  if(r.type==="ticketBuy") return `${ticketMeta[r.ticketId]?.name} 구매`;
  if(r.type==="ticketSell") return `${ticketMeta[r.ticketId]?.name} 판매`;
  if(r.type==="ticketUse") return `${ticketMeta[r.ticketId]?.name} 사용`;
  if(r.type==="bondBuy"){ const i=obj(data.bondIssues)[r.issueId]; return `${i?bondIssueName(i):"채권"} ${won(i?.principal ?? r.amount)} 구매`; }
  if(r.type==="depositIn") return `${won(r.amount)} 예금 입금`;
  if(r.type==="depositOut") return `${won(r.amount)} 예금 출금`;
  if(r.type==="savingsStart") return `2일마다 ${won(r.amount)} 납입 적금 개설 / ${n(r.days)||21}일 / 매주 복리 ${n(r.rate)||Math.round(savingsRate()*100)}%`;
  if(r.type==="loanApply") return `${won(r.amount)} 대출 신청${r.purpose?` · ${r.purpose}`:""}`;
  return "";
}

function renderStudentsPageDesktop(){
  document.getElementById("students").innerHTML = `
    <div class="section">
      <div class="head"><div><h2>학생 등록</h2><div class="sub">PIN은 학생 로그인용입니다. 처음엔 4자리 숫자로 넣으면 됩니다.</div></div></div>
      <div class="grid g2">
        <div class="card">
          <h3>한 명 추가</h3>
          <div class="field"><label>이름</label><input id="addName" placeholder="김열매"></div>
          <div class="field"><label>직업</label><input id="addJob" placeholder="소매상"></div>
          <div class="field"><label>PIN</label><input id="addPin" value="1234"></div>
          <div class="field"><label>초기 지급</label><input id="addInitial" type="number" value="0"></div>
          <button class="primary" onclick="addStudent()">학생 추가</button>
        </div>
        <div class="card">
          <h3>여러 명 추가</h3>
          <textarea id="bulkNames" placeholder="김열매&#10;이채권&#10;박티켓"></textarea>
          <div class="field"><label>1인 초기 지급</label><input id="bulkInitial" type="number" value="0"></div>
          <button class="blue" onclick="bulkAddStudents()">명단 일괄 추가</button>
        </div>
      </div>
    </div>
    <div class="section">
      <h2>학생 잔고표</h2>
      <div class="scroll"><table><thead><tr><th>이름</th><th>직업</th><th>PIN</th><th class="num">현금</th><th class="num">예금</th><th>티켓</th><th>관리</th></tr></thead><tbody>
      ${students().map(s=>studentRow(s)).join("") || `<tr><td colspan="7">학생 없음</td></tr>`}
      </tbody></table></div>
    </div>
    ${approvedWorkClaimsPayoutHtml()}
    ${taxOfficeTeacherWageHtml()}`;
}
function renderStudentsPage(){
  if(!isMobileViewport()) return renderStudentsPageDesktop();
  if(activeMobileTeacherPage){
    renderStudentsPageDesktop();
    document.getElementById("students").innerHTML = `${mobileSubPageHeader({
      list:"학생 목록",balance:"잔액 수정",jobs:"직업 배정",credit:"신용도 관리",fine:"경고/벌금 관리"
    }[activeMobileTeacherPage]||"학생관리","backMobileTeacherPage()")}<div class="mobileTeacherDetail">${document.getElementById("students").innerHTML}</div>`;
    return;
  }
  document.getElementById("students").innerHTML = `<div class="section"><div class="head"><div><h2>학생관리</h2><div class="sub">학생 관련 관리를 필요한 메뉴로 나눠 처리합니다.</div></div></div>${mobileMenuGrid([
    {id:"list",icon:"◉",title:"학생 목록",description:"학생 추가, 정보 수정, 상세 보기",badge:`${students().length}명`},
    {id:"balance",icon:"₩",title:"잔액 수정",description:"학생별 잔액과 예금 확인"},
    {id:"jobs",icon:"⚙",title:"직업 배정",description:"학생 직업과 임금 관리"},
    {id:"credit",icon:"★",title:"신용도 관리",description:"신용도와 경고 확인"},
    {id:"fine",icon:"!",title:"경고/벌금 관리",description:"벌금 고지와 정리"}
  ].map(c=>({...c,onClick:`openMobileTeacherPage('${c.id}')`})))}</div>`;
}
function studentRow(s){
  const tickets=Object.keys(ticketMeta).map(k=>`${ticketMeta[k].name.replace(" 면제권","").replace("1시간 ","")} ${n(obj(obj(data.ticketHoldings)[s.id])[k])}`).join(" / ");
  return `<tr><td><b>${s.name}</b></td><td>${studentJobName(s)}</td><td>${s.pin||""}</td><td class="num"><b>${won(balanceOf(s.id))}</b></td><td class="num">${won(obj(data.deposits)[s.id]||0)}</td><td>${tickets}</td><td><button class="blue" onclick="showStudentDetail('${s.id}')">상세</button> <button onclick="editStudent('${s.id}')">수정</button> <button class="danger" onclick="deleteStudent('${s.id}')">삭제</button></td></tr>`;
}



function jobs(){return arr(data.jobs).sort((a,b)=>(a.name||"").localeCompare(b.name||"","ko"))}
function job(id){return obj(data.jobs)[id]}
function studentJobIds(s){
  if(!s) return [];
  const ids=[];
  const raw=s.jobIds;
  if(Array.isArray(raw)) ids.push(...raw.filter(Boolean));
  else if(raw && typeof raw==="object") Object.entries(raw).forEach(([k,v])=>{if(v) ids.push(k)});
  if(s.jobId) ids.push(s.jobId);
  return [...new Set(ids)].filter(id=>job(id));
}
function studentJobName(s){
  const names=studentJobIds(s).map(id=>job(id)?.name).filter(Boolean);
  if(names.length) return names.join(" / ");
  return s?.job || "";
}
function jobNamesFromIds(ids){return ids.map(id=>job(id)?.name).filter(Boolean).join(" / ")}
function studentJobId(id){return studentJobIds(student(id))[0] || ""}
function studentHasJob(s,jobId){return studentJobIds(s).includes(jobId)}
function studentHasRole(id,roleId){return studentHasJob(student(id),roleId)}
function specialRoleIdsForStudent(id){return ["police","tax_office","referee","banker"].filter(roleId=>studentHasRole(id,roleId))}
function specialRoleName(roleId){return {police:"경찰",tax_office:"국세청",referee:"심판",banker:"은행장"}[roleId]||roleId}
function workClaims(){return arr(data.workClaims).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))}
function claimStatusText(status){
  return {pending:"심사 대기",approved:"승인됨",rejected:"거부됨",held:"보류됨",paid:"지급 완료"}[status] || status || "-";
}
function isPieceRateJob(j){
  const pay=String(j?.payType||"");
  return !!j && (j.isPieceRate || j.requiresReview || pay.includes("건당"));
}
function pieceRateJobsForStudent(studentId){
  const s=student(studentId);
  return studentJobIds(s).map(job).filter(isPieceRateJob);
}
function jobWageRulesForJob(jobId){
  const rules=arr(data.jobWageRules).filter(r=>r.jobId===jobId || r.jobName===job(jobId)?.name);
  if(rules.length) return rules.filter(r=>r.isPieceRate!==false && r.requiresReview!==false);
  const j=job(jobId);
  if(!isPieceRateJob(j)) return [];
  return [{id:`${jobId}_default`,jobId,jobName:j.name,workType:"default",workTypeName:j.name+" 업무",wage:money(j.wage),isPieceRate:true,requiresReview:true}];
}
function pieceRateWorkRulesForStudent(studentId){
  return pieceRateJobsForStudent(studentId).flatMap(j=>jobWageRulesForJob(j.id).map(r=>({...r,jobId:j.id,jobName:j.name})));
}
function workRuleByClaim(c){
  return jobWageRulesForJob(c.jobId).find(r=>String(r.workType||r.id||"default")===String(c.workType||"default")) || null;
}
function workRuleSelectOptions(studentId){
  const rows=pieceRateWorkRulesForStudent(studentId);
  if(!rows.length) return `<option value="">건당 지급 업무 없음</option>`;
  return rows.map(r=>`<option value="${r.jobId}::${r.workType||r.id||"default"}">${r.jobName} - ${r.workTypeName||r.name||"업무"} (${won(r.wage)})</option>`).join("");
}
function workClaimsForStudent(studentId){return workClaims().filter(c=>c.studentId===studentId)}
function approvedUnpaidClaims(){return workClaims().filter(c=>c.status==="approved" && c.paid!==true && money(c.approvedWage)>0)}
function sameDay(isoOrDay,day=today()){return String(isoOrDay||"").slice(0,10)===day}
function taxOfficeWageEstimate(officerId,day=today()){
  const reviewed=workClaims().filter(c=>c.reviewedBy===officerId && ["approved","rejected","held","paid"].includes(c.status) && sameDay(c.reviewedAt,day));
  const collections=ledgerForDay(day).filter(e=>obj(e.meta).taxAudited && obj(e.meta).officer===officerId);
  const collectedTaxAmount=collections.reduce((sum,e)=>sum+n(obj(e.meta).tax)+n(obj(e.meta).centralTax),0);
  const reviewPay=reviewed.length*2;
  const collectionPay=collections.length*5;
  const bonus=Math.min(money(collectedTaxAmount*0.1),20);
  return {day,reviewedClaimsCount:reviewed.length,collectedTaxCasesCount:collections.length,collectedTaxAmount,reviewPay,collectionPay,bonus,total:money(reviewPay+collectionPay+bonus)};
}
function taxOfficeWageRecordId(officerId,day=today()){return `${officerId}_${day}`}
function isCorporationJobId(jobId){
  const j=job(jobId);
  const key=String(jobId||"").toLocaleLowerCase("ko-KR");
  const name=String(j?.name||"").toLocaleLowerCase("ko-KR");
  return key==="corporation" || key==="corp" || key==="company" || key.includes("corporation") || name.includes("법인") || name.includes("회사");
}
function isCorporationAssignedStudent(id){
  const s=student(id);
  if(!s) return false;
  if(s.isCorporationAccount===true || s.isCorporation===true || s.accountType==="corporation") return true;
  if(s.corporationId && String(s.corporationId)===String(id)) return true;
  if(corporationRaw(id)) return true;
  const jobText=String(s.job||"").replace(/\s+/g,"").toLocaleLowerCase("ko-KR");
  if(jobText.includes("법인") || jobText.includes("회사") || jobText.includes("corporation") || jobText.includes("corp")) return true;
  if(studentJobIds(s).some(isCorporationJobId)) return true;
  return corporations().some(c=>String(c.id)===String(id) || String(c.cashAccountId||"")===String(id) || String(c.accountId||"")===String(id));
}
function roleWarnings(){return arr(data.roleWarnings).sort((a,b)=>(b.ts||"").localeCompare(a.ts||""))}
function activeWarningsForStudent(id,source=""){
  return roleWarnings().filter(w=>w.targetId===id && w.status!=="cancelled" && (!source || w.source===source));
}
function warningCountForStudent(id,source=""){
  return activeWarningsForStudent(id,source).length;
}
function legacyWarningCount(value){
  if(Array.isArray(value)) return value.length;
  if(value && typeof value==="object") return Object.values(value).filter(Boolean).length;
  return n(value);
}
function policeWarningsForCredit(id){
  const rows=activeWarningsForStudent(id,"police");
  const s=obj(student(id));
  const legacyCount=legacyWarningCount(s.policeWarning)+legacyWarningCount(s.policeWarnings)+legacyWarningCount(obj(data.policeWarning)[id])+legacyWarningCount(obj(data.policeWarnings)[id]);
  return {rows,legacyCount,total:rows.length+legacyCount};
}
function dutyStage(id){return Math.max(0,Math.min(3,Math.floor(n(obj(data.dutyNeglect)[id]))))}
function dutyPenaltyLabel(id){
  const s=dutyStage(id);
  return s===1?"임금 1/3 삭감":s===2?"임금 1/2 삭감":s===3?"임금 없음":"없음";
}
function dutyWageMultiplier(id){
  const s=dutyStage(id);
  if(s===1) return 2/3;
  if(s===2) return 1/2;
  if(s>=3) return 0;
  return 1;
}
function recentIncomeOf(id,days=7){
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-days+1);
  return (obj(derived.ledgerByAccount)[id] || []).filter(e=>{
    const d=new Date((e.ts||"").slice(0,10)+"T00:00:00");
    return !Number.isNaN(+d) && d>=cutoff;
  }).reduce((sum,e)=>sum+arr(e.lines).filter(l=>l.account===id && n(l.delta)>0).reduce((a,l)=>a+n(l.delta),0),0);
}
function taxAuditPenaltyCount(id){
  return (obj(derived.ledgerByAccount)[id] || []).filter(e=>obj(e.meta).taxAudited && arr(e.lines).some(l=>l.account===id && n(l.delta)<0)).length;
}
function creditScoreInfo(id){
  const asset=totalAssetsOf(id);
  const income=recentIncomeOf(id,7);
  const warningCredit=policeWarningsForCredit(id);
  const warningsRows=warningCredit.rows;
  const now=Date.now();
  const daysAgo=(iso)=>{ const t=new Date(iso||0).getTime(); return Number.isNaN(t) ? 9999 : (now-t)/(24*60*60*1000); };
  const recentWarnings=warningsRows.filter(w=>daysAgo(w.ts)<=14).length;
  const oldWarnings=Math.max(0,warningsRows.length-recentWarnings)+warningCredit.legacyCount;
  const stage=dutyStage(id);
  const audits=taxAuditPenaltyCount(id);
  const debt=activeLoanBalance(id);
  const unpaidRows=unpaidFinesForStudent(id);
  const overdueFines=unpaidRows.filter(f=>fineEffectiveStatus(f)==="overdue").length;
  const unpaidFineTotal=unpaidRows.reduce((sum,f)=>sum+remainingFineAmount(f),0);
  const paidFineCount=fineRowsForStudent(id).filter(f=>fineEffectiveStatus(f)==="paid").length;
  const lastWarningAge=warningsRows.length ? Math.min(...warningsRows.map(w=>daysAgo(w.ts))) : 9999;
  let recoveryBonus=0;
  if(lastWarningAge>=3) recoveryBonus+=15;
  if(lastWarningAge>=7) recoveryBonus+=25;
  if(lastWarningAge>=14) recoveryBonus+=40;
  recoveryBonus+=Math.min(30,paidFineCount*5);
  const assetBonus=Math.min(80, Math.floor(asset/250));
  const incomeBonus=Math.min(50, Math.floor(income/250));
  const warningPenalty=recentWarnings*25 + oldWarnings*8;
  const dutyPenalty=stage*45;
  const auditPenalty=audits*45;
  const debtPenalty=Math.min(90, Math.floor(debt/80));
  const finePenalty=unpaidRows.length*25 + overdueFines*35 + Math.min(120,Math.floor(unpaidFineTotal/15));
  let score=700 + assetBonus + incomeBonus + recoveryBonus - warningPenalty - dutyPenalty - auditPenalty - debtPenalty - finePenalty;
  score=Math.max(300,Math.min(1000,Math.round(score)));
  const grade=score>=900?"S":score>=800?"A":score>=700?"B":score>=600?"C":score>=500?"D":"E";
  const reason=`자산 +${assetBonus}, 최근소득 +${incomeBonus}, 성실회복 +${recoveryBonus}, 최근 경찰경고 -${recentWarnings*25}, 오래된 경찰경고 -${oldWarnings*8}, 직무유기 -${dutyPenalty}, 세금적발 -${auditPenalty}, 대출부담 -${debtPenalty}, 미납벌금 -${finePenalty}`;
  return {score,grade,reason,asset,income,warnings:warningCredit.total,recentWarnings,oldWarnings,stage,audits,debt,overdueFines,unpaidFineTotal,recoveryBonus};
}
function creditScorePill(id){
  const c=creditScoreInfo(id);
  const cls=c.score>=800?"green":c.score>=700?"blue":c.score>=600?"orange":"red";
  return `<span class="pill ${cls}" title="${c.reason}">신용 ${c.grade} · ${c.score}점</span>`;
}
function creditSummaryCard(id){
  const c=creditScoreInfo(id);
  return `<div class="creditScoreCard"><div><span class="small">신용도</span><b>${c.grade}</b><em>${c.score}점</em></div><p class="small">${c.reason}</p><p class="small"><b>경찰 경고</b>는 신용도에 반영됩니다. <b>심판 경고</b>는 경기/활동 중 주의 기록이며 신용도에는 영향이 없습니다.</p></div>`;
}
function roleWarningRowsForStudent(id){
  const rows=activeWarningsForStudent(id).slice(0,8);
  if(!rows.length) return `<p class="small">받은 경고가 없습니다.</p>`;
  return `<div class="roleWarningMiniList">${rows.map(w=>`<div><b>${specialRoleName(w.source)} 경고</b><span>${w.reason||"사유 없음"}</span><em>${w.status==="appealed"?"이의신청 중":w.status==="upheld"?"유지":"진행"}</em>${w.appealable && w.status==="issued"?`<button onclick="appealRoleWarning('${w.id}')">이의신청</button>`:""}</div>`).join("")}</div>`;
}
function fineNoticeHtml(id){
  const rows=unpaidFinesForStudent(id);
  if(!rows.length) return "";
  const total=rows.reduce((sum,f)=>sum+remainingFineAmount(f),0);
  return `<div class="section fineNoticePanel">
    <div class="head"><div><h2>미납 벌금 고지서</h2><div class="sub">벌금은 경고 2회가 된 순간의 재산 기준으로 이미 확정됩니다.</div></div><span class="pill red">미납 ${won(total)}</span></div>
    <div class="fineNoticeList">${rows.map(f=>{
      const snap=obj(f.assetSnapshot);
      const remain=remainingFineAmount(f);
      const status=fineEffectiveStatus(f);
      return `<div class="fineNoticeCard ${status}">
        <div class="fineNoticeTop"><div><b>${f.reason||"벌금"}</b><span>${status==="overdue"?"납부기한 지남":status==="partial"?"부분 납부":"미납"}</span></div><strong>${won(remain)}</strong></div>
        <div class="fineNoticeMeta">총 벌금 ${won(f.fineAmount)} · 납부 ${won(f.paidAmount)} · 기한 ${f.dueDate||"-"}</div>
        <div class="fineSnapshotGrid">
          <span>현금 ${won(snap.personalCash)}</span><span>예금 ${won(snap.deposits)}</span><span>적금 ${won(snap.savings)}</span><span>채권 ${won(snap.bonds)}</span><span>티켓 ${won(snap.ticketsValue)}</span><span>법인주식 ${won(snap.corporateEquityValue)}</span>
        </div>
        <p class="small">벌금은 경고 2회가 된 순간의 재산을 기준으로 정해집니다. 나중에 돈을 다른 곳으로 옮겨도 벌금은 줄어들지 않습니다. 법인에 넣어둔 열매도 내 주식 지분만큼은 내 재산으로 계산됩니다.</p>
        <div class="toolbar"><button class="danger" onclick="payFineNotice('${f.id}')">잔고로 납부</button>${balanceOf(id)<remain?`<span class="pill orange">잔고 부족: 부분 납부 가능</span>`:""}</div>
      </div>`;
    }).join("")}</div>
  </div>`;
}
function fineAdminTableHtml(){
  const rows=arr(data.fines).sort((a,b)=>(b.issuedAt||"").localeCompare(a.issuedAt||"")).slice(0,50);
  if(!rows.length) return `<p class="small">발행된 벌금 고지서가 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>사유</th><th class="num">벌금</th><th class="num">납부</th><th class="num">남은 금액</th><th>기한</th><th>상태</th></tr></thead><tbody>${rows.map(f=>{
    const status=fineEffectiveStatus(f);
    return `<tr><td>${studentName(f.studentId)}</td><td>${f.reason||"-"}</td><td class="num">${won(f.fineAmount)}</td><td class="num">${won(f.paidAmount)}</td><td class="num"><b>${won(remainingFineAmount(f))}</b></td><td>${f.dueDate||"-"}</td><td><span class="pill ${status==="paid"?"green":status==="overdue"?"red":status==="partial"?"orange":"blue"}">${status}</span></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function assignedStudentsForJob(jobId){return students().filter(s=>studentHasJob(s,jobId))}
function jobOptions(selected=""){
  return `<option value="">직업 선택</option>` + jobs().map(j=>`<option value="${j.id}" ${j.id===selected?"selected":""}>${j.name} / ${won(j.wage)} / ${j.payType}</option>`).join("");
}
function removableJobOptions(studentId){
  const ids=studentJobIds(student(studentId));
  if(!ids.length) return `<option value="">보유 직업 없음</option>`;
  return ids.map(id=>`<option value="${id}">${job(id)?.name||id}</option>`).join("");
}
function jobTableHtml(){
  const list=jobs();
  if(!list.length) return `<p class="small">등록된 직업이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>직업</th><th class="num">임금</th><th>지급방식</th><th>정원</th><th>배정 학생</th><th>관리</th></tr></thead><tbody>${list.map(j=>{
    const assigned=assignedStudentsForJob(j.id);
    const cap=n(j.slots)||0;
    return `<tr><td><b>${j.name}</b>${j.note?`<br><span class="small">${j.note}</span>`:""}</td><td class="num">${j.payType==="자율"?"자율":won(j.wage)}</td><td>${j.payType}</td><td>${cap?`${assigned.length}/${cap}`:"제한 없음"}</td><td>${assigned.map(s=>s.name).join(", ")||"-"}</td><td><button onclick="editJob('${j.id}')">수정</button> <button class="danger" onclick="deleteJob('${j.id}')">삭제</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function studentJobAssignmentRows(){
  const st=students();
  if(!st.length) return `<p class="small">등록된 학생이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>현재 직업</th><th>직업 추가</th><th>직업 제거</th><th>관리</th></tr></thead><tbody>${st.map(s=>`<tr>
    <td><b>${s.name}</b></td>
    <td>${studentJobName(s)||"-"}<br><span class="small">직무유기 ${dutyStage(s.id)}단계 · ${dutyPenaltyLabel(s.id)}</span></td>
    <td><select id="assignJob_${s.id}">${jobOptions()}</select></td>
    <td><select id="removeJob_${s.id}">${removableJobOptions(s.id)}</select></td>
    <td><button class="blue" onclick="assignJobToStudent('${s.id}')">추가</button> <button onclick="removeJobFromStudent('${s.id}')">제거</button> <button class="danger" onclick="clearJobsFromStudent('${s.id}')">전체 해제</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function roleAdminPanelHtml(){
  return `<div class="roleAdminGrid">
    <div class="card"><div class="miniHead"><h3>학생별 신용도·권한</h3><button onclick="showCreditHelp()">도움말</button></div>${creditTableHtml()}</div>
    <div class="card"><h3>경고 이의신청</h3>${roleWarningAppealTableHtml()}</div>
    <div class="card"><h3>직무유기 단계 초기화</h3><div class="field"><label>학생</label><select id="resetDutyStudent">${studentOptions()}</select></div><button onclick="resetDutyStage()">직무유기 0단계로</button></div>
  </div>`;
}
function creditTableHtml(){
  const rows=students().map(s=>({s,c:creditScoreInfo(s.id)})).sort((a,b)=>b.c.score-a.c.score);
  if(!rows.length) return `<p class="small">학생 없음</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>직업</th><th>신용</th><th>경찰 경고</th><th>심판 경고</th><th>직무유기</th></tr></thead><tbody>${rows.map(({s,c})=>`<tr><td>${s.name}</td><td>${studentJobName(s)||"-"}</td><td><span class="pill ${c.score>=800?'green':c.score>=700?'blue':c.score>=600?'orange':'red'}">${c.grade} · ${c.score}</span></td><td>${warningCountForStudent(s.id,"police")}회<br><span class="small">신용도 반영</span></td><td>${warningCountForStudent(s.id,"referee")}회<br><span class="small">기록만 보관</span></td><td>${dutyStage(s.id)}단계</td></tr>`).join("")}</tbody></table></div>`;
}
function roleWarningAppealTableHtml(){
  const rows=roleWarnings().filter(w=>w.appealable && w.status==="appealed");
  if(!rows.length) return `<p class="small">처리할 이의신청이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>종류</th><th>사유</th><th>이의 내용</th><th>처리</th></tr></thead><tbody>${rows.map(w=>`<tr><td>${studentName(w.targetId)}</td><td>${specialRoleName(w.source)}</td><td>${w.reason||"사유 없음"}</td><td>${w.appealReason||""}</td><td><button class="green" onclick="resolveRoleWarningAppeal('${w.id}','cancelled')">인용</button> <button class="orange" onclick="resolveRoleWarningAppeal('${w.id}','upheld')">기각</button></td></tr>`).join("")}</tbody></table></div>`;
}
function studentWorkClaimsHtml(id){
  const rules=pieceRateWorkRulesForStudent(id);
  const rows=workClaimsForStudent(id);
  return `<div class="section">
    <div class="head"><div><h2>업무 기록 제출</h2><div class="sub">건당 지급 직업의 업무를 제출하면 국세청 심사 후 교사가 지급합니다.</div></div>${currentAssetPill(id)}</div>
    ${rules.length?`<div class="grid g2">
      <div class="card">
        <h3>새 업무 기록</h3>
        <div class="field"><label>일자</label><input id="workClaimDate" type="date" value="${today()}"></div>
        <div class="field"><label>업무 종류</label><select id="workClaimRule">${workRuleSelectOptions(id)}</select></div>
        <div class="field"><label>상황 설명</label><textarea id="workClaimSituation" placeholder="무슨 일을 했는지 적어주세요"></textarea></div>
        <div class="field"><label>관련 대상</label><input id="workClaimTarget" placeholder="학생, 법인, 가게 등"></div>
        <div class="field"><label>증거/설명</label><textarea id="workClaimEvidence" placeholder="확인할 수 있는 내용"></textarea></div>
        <button class="primary" onclick="submitWorkClaim()">제출</button>
      </div>
      <div class="card">
        <h3>내 제출 목록</h3>
        ${studentWorkClaimTableHtml(id,rows)}
      </div>
    </div>`:`<p class="small">현재 건당 지급 직업이 없어 업무 기록을 제출할 수 없습니다.</p>`}
  </div>`;
}
function studentWorkClaimTableHtml(id,rows=workClaimsForStudent(id)){
  if(!rows.length) return `<p class="small">제출한 업무 기록이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>일자</th><th>업무</th><th>상태</th><th class="num">임금</th><th>심사 사유</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${c.workDate||"-"}</td><td><b>${c.workTypeName||"-"}</b><br><span class="small">${c.situation||""}</span></td><td><span class="pill ${c.status==="paid"||c.status==="approved"?"green":c.status==="pending"?"blue":c.status==="held"?"orange":"red"}">${claimStatusText(c.status)}</span></td><td class="num">${c.approvedWage?won(c.approvedWage):"-"}</td><td>${c.reviewReason||"-"}</td></tr>`).join("")}</tbody></table></div>`;
}
function taxOfficeReviewHtml(officerId){
  const rows=workClaims().filter(c=>c.status==="pending");
  const estimate=taxOfficeWageEstimate(officerId);
  const paid=obj(data.taxOfficeWageRecords)[taxOfficeWageRecordId(officerId,estimate.day)];
  const estimateBox=`<div class="card"><h3>오늘 국세청 예상 임금</h3><p class="small">심사 ${estimate.reviewedClaimsCount}건 x 2 + 징수 ${estimate.collectedTaxCasesCount}건 x 5 + 징수액 보너스</p><div class="value">${won(estimate.total)}</div><div class="small">징수액 ${won(estimate.collectedTaxAmount)} / 보너스 ${won(estimate.bonus)}${paid?` / 지급완료 ${won(paid.amount)}`:""}</div></div>`;
  const table=!rows.length ? `<p class="small">심사 대기 중인 업무 기록이 없습니다.</p>` : `<div class="scroll"><table><thead><tr><th>제출자</th><th>직업/업무</th><th>일자</th><th>상황</th><th>증거</th><th>처리</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${c.studentName||studentName(c.studentId)}</td><td><b>${c.jobName||"-"}</b><br>${c.workTypeName||"-"}</td><td>${c.workDate||"-"}</td><td>${c.situation||"-"}<br><span class="small">${c.relatedTarget||""}</span></td><td>${c.evidenceText||"-"}</td><td>${c.studentId===officerId?`<span class="pill red">본인 기록 처리 불가</span>`:`<div class="toolbar"><button class="green" onclick="reviewWorkClaim('${c.id}','approved')">승인</button><button class="danger" onclick="reviewWorkClaim('${c.id}','rejected')">거부</button><button class="orange" onclick="reviewWorkClaim('${c.id}','held')">보류</button></div>`}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="section rolePanel taxPanel"><div class="head"><div><h2>업무 심사</h2><div class="sub">건당 지급 업무 기록을 승인, 거부, 보류합니다.</div></div><span class="pill green">국세청</span></div><div class="grid g2">${estimateBox}<div class="card"><h3>심사 대기 목록</h3>${table}</div></div></div>`;
}
function snackRetailerPurchaseHtml(id){
  const products=arr(data.products);
  const rows=products.map(p=>{
    const stock=p.stock ?? p.wholesaleStock ?? p.inventory;
    const price=productWholesalePrice(p);
    return `<tr><td><b>${p.name}</b><br><span class="small">${p.note||""}</span></td><td class="num">${won(price)}</td><td class="num">${stock===undefined?"-":n(stock)}</td><td><input id="snackQty_${p.id}" type="number" min="1" value="1" style="width:80px"></td><td><button class="green" onclick="buyRetailerSnack('${p.id}')">구매</button></td></tr>`;
  }).join("");
  return `<div class="section">
    <div class="head"><div><h2>과자 구매</h2><div class="sub">과자 소매상만 도매 재고를 구매해 판매 재고로 확보할 수 있습니다.</div></div>${currentAssetPill(id)}</div>
    <div class="scroll"><table><thead><tr><th>과자</th><th class="num">구매가</th><th class="num">남은 재고</th><th>수량</th><th>구매</th></tr></thead><tbody>${rows||`<tr><td colspan="5">등록된 상품이 없습니다.</td></tr>`}</tbody></table></div>
    <h3>내 판매 재고</h3>
    <p class="small">${inventoryHtml(id)}</p>
  </div>`;
}
function roleWorkHtml(id){
  const roles=specialRoleIdsForStudent(id);
  if(!roles.length) return `<div class="section"><h2>직업업무</h2><p class="small">경찰, 국세청, 심판, 은행장 직업을 가진 학생만 사용할 수 있습니다.</p></div>`;
  return `<div class="roleWorkPage">
    <div class="section"><div class="head"><div><h2>직업업무</h2><div class="sub">현재 권한: ${roles.map(specialRoleName).join(" / ")}</div></div>${creditScorePill(id)}</div></div>
    ${roles.includes("police")?policeWorkHtml(id):""}
    ${roles.includes("tax_office")?taxOfficeWorkHtml(id):""}
    ${roles.includes("referee")?refereeWorkHtml(id):""}
    ${roles.includes("banker")?bankerWorkHtml(id):""}
  </div>`;
}
function policeWorkHtml(id){
  return `<div class="section rolePanel policePanel">
    <div class="head"><div><h2>경찰 업무</h2><div class="sub">직무유기 단계 감시와 사유 필수 경고를 처리합니다. 학생은 이의신청할 수 있고, 내가 부여한 경고는 직접 취소할 수 있습니다.</div></div><span class="pill blue">경찰</span></div>
    <div class="roleActionGrid">
      <div class="card"><h3>직무유기 단계 지정</h3><div class="field"><label>대상</label><select id="policeDutyTarget">${studentOptions()}</select></div><div class="field"><label>단계</label><select id="policeDutyStage"><option value="0">0단계 없음</option><option value="1">1단계 임금 1/3 삭감</option><option value="2">2단계 임금 1/2 삭감</option><option value="3">3단계 임금 없음</option></select></div><button class="blue" onclick="setDutyNeglectByPolice()">단계 저장</button></div>
      <div class="card"><h3>학생 경고</h3><div class="field"><label>대상</label><select id="policeWarnTarget">${studentOptions()}</select></div><div class="field"><label>사유 필수</label><textarea id="policeWarnReason" placeholder="경고 사유를 반드시 입력"></textarea></div><button class="orange" onclick="issuePoliceWarning()">경고 부여</button></div>
    </div>
    <h3>내가 부여한 경찰 경고</h3>${roleWarningTableHtml("police",id)}
    <h3>경찰 경고 이의신청 현황</h3>${roleWarningAppealStatusTableHtml("police",id)}
  </div>`;
}
function refereeWorkHtml(id){
  return `<div class="section rolePanel refereePanel">
    <div class="head"><div><h2>심판 업무</h2><div class="sub">경고 사유는 선택입니다. 학생은 이의신청을 할 수 있습니다. 경고 2회마다 벌금이 부과됩니다.</div></div><span class="pill purple">심판</span></div>
    <div class="roleActionGrid">
      <div class="card"><h3>학생 경고</h3><div class="field"><label>대상</label><select id="refereeWarnTarget">${studentOptions()}</select></div><div class="field"><label>사유 선택</label><textarea id="refereeWarnReason" placeholder="선택 입력"></textarea></div><button class="purple" onclick="issueRefereeWarning()">경고 부여</button></div>
      <div class="card"><h3>내가 처리한 경고</h3>${roleWarningTableHtml("referee",id)}</div>
    </div>
    <h3>심판 경고 이의신청 현황</h3>${roleWarningAppealStatusTableHtml("referee",id)}
  </div>`;
}
function taxOfficeWorkHtml(id){
  return `<div class="section rolePanel taxPanel">
    <div class="head"><div><h2>국세청 업무</h2><div class="sub">세금 미납 거래를 적발하면 세액의 1.5배를 징수합니다. 원래 세액은 국고, 추가 0.5배는 국세청 몫입니다.</div></div><span class="pill green">국세청</span></div>
    ${taxAuditListHtml(id)}
    ${taxOfficeReviewHtml(id)}
  </div>`;
}

function loanRequestRowsHtml(bankerId){
  const rows=arr(data.requests).filter(r=>r.type==="loanApply").sort((a,b)=>(a.ts||"").localeCompare(b.ts||""));
  if(!rows.length) return `<p class="small">대기 중인 대출 신청이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th>신용</th><th class="num">신청액</th><th>한도</th><th>목적</th><th>금리</th><th>처리</th></tr></thead><tbody>${rows.map(r=>{
    const lim=loanLimitInfo(r.studentId);
    const sug=suggestedLoanRate(r.studentId);
    return `<tr><td>${studentName(r.studentId)}</td><td>${creditScorePill(r.studentId)}</td><td class="num"><b>${won(r.amount)}</b></td><td><span class="small">가능 ${won(lim.available)}<br>DSR ${won(lim.dsr)} / LTV ${won(lim.ltv)}</span></td><td>${r.purpose||"-"}</td><td><input class="loanRateInput" id="loanRate_${r.id}" type="number" value="${sug}" min="0" step="0.5">%</td><td><button class="green" onclick="bankApproveLoan('${r.id}')">승인</button> <button class="danger" onclick="bankRejectLoan('${r.id}')">거절</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function loanPortfolioHtml(){
  const rows=arr(data.loans).sort((a,b)=>(b.start||"").localeCompare(a.start||""));
  if(!rows.length) return `<p class="small">아직 대출 내역이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>학생</th><th class="num">원금</th><th class="num">금리</th><th class="num">상환액</th><th>상환일</th><th>상태</th></tr></thead><tbody>${rows.map(l=>`<tr><td>${studentName(l.owner)}</td><td class="num">${won(l.amount)}</td><td class="num">${n(l.rate)}%</td><td class="num">${won(money(n(l.amount)*(1+n(l.rate)/100)))}</td><td>${l.due||"-"}</td><td><span class="pill ${l.status==="active"?"orange":"green"}">${l.status==="active"?"상환중":"상환완료"}</span></td></tr>`).join("")}</tbody></table></div>`;
}
function bankerWorkHtml(id){
  return `<div class="section rolePanel bankerPanel">
    <div class="head"><div><h2>은행장 업무</h2><div class="sub">대출 신청을 심사하고 학생별 금리를 정합니다. 한도는 DSR·LTV·신용도 기준으로 자동 계산됩니다.</div></div><span class="pill blue">은행장</span></div>
    <div class="bankerGrid">
      <div class="card"><h3>대출 신청 심사</h3>${loanRequestRowsHtml(id)}</div>
      <div class="card"><h3>대출 현황</h3>${loanPortfolioHtml()}</div>
    </div>
  </div>`;
}

function roleWarningTableHtml(source,actorId=""){
  const rows=roleWarnings().filter(w=>w.source===source && (!actorId || w.actorId===actorId)).slice(0,10);
  if(!rows.length) return `<p class="small">기록 없음</p>`;
  return `<div class="scroll"><table><thead><tr><th>날짜</th><th>대상</th><th>사유</th><th>상태</th><th>관리</th></tr></thead><tbody>${rows.map(w=>`<tr><td>${(w.ts||"").slice(0,10)}</td><td>${studentName(w.targetId)}</td><td>${w.reason||"사유 없음"}</td><td>${w.status==="cancelled"?"취소":w.status==="appealed"?"이의신청":w.status==="upheld"?"유지":"진행"}</td><td>${w.status!=="cancelled" && actorId && w.actorId===actorId?`<button class="danger" onclick="cancelMyRoleWarning('${w.id}')">취소</button>`:"-"}</td></tr>`).join("")}</tbody></table></div>`;
}
function roleWarningAppealStatusText(status){
  if(status==="appealed") return "이의신청 접수";
  if(status==="upheld") return "경고 유지";
  if(status==="cancelled") return "경고 취소";
  return "이의신청 없음";
}
function roleWarningAppealStatusTableHtml(source,actorId=""){
  const rows=roleWarnings().filter(w=>w.source===source && (!actorId || w.actorId===actorId) && (w.appealable || w.appealReason || w.appealedAt || ["appealed","upheld","cancelled"].includes(w.status))).slice(0,20);
  if(!rows.length) return `<p class="small">이의신청 현황이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>접수일</th><th>대상</th><th>경고 사유</th><th>이의 내용</th><th>상태</th><th>처리일</th></tr></thead><tbody>${rows.map(w=>`<tr><td>${(w.appealedAt||w.ts||"").slice(0,10)||"-"}</td><td>${studentName(w.targetId)}</td><td>${w.reason||"사유 없음"}</td><td>${w.appealReason||"-"}</td><td><span class="pill ${w.status==="cancelled"?"red":w.status==="upheld"?"orange":w.status==="appealed"?"blue":"green"}">${roleWarningAppealStatusText(w.status)}</span></td><td>${(w.reviewedAt||w.cancelledAt||"").slice(0,10)||"-"}</td></tr>`).join("")}</tbody></table></div>`;
}
function taxAuditCandidates(){
  return (derived.ledger || []).filter(e=>isStudentTradeLedger(e) && taxableLedgerLines(e).length>0).sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
}
function taxAuditListHtml(officerId){
  const rows=taxAuditCandidates().slice(0,20);
  if(!rows.length) return `<p class="small">현재 적발 가능한 미납 거래가 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>날짜</th><th>거래</th><th>납부자/세금</th><th>징수</th></tr></thead><tbody>${rows.map(e=>{
    const lines=taxableLedgerLines(e);
    const taxTotal=lines.reduce((a,l)=>a+l.amount,0);
    return `<tr><td>${(e.ts||"").slice(0,16).replace("T"," ")}</td><td>${e.desc}</td><td>${lines.map(l=>`${studentName(l.account)} 세금 ${won(l.amount)}`).join("<br>")}</td><td><button class="green" onclick="taxOfficeCollect('${e.id}')">1.5배 ${won(taxTotal*1.5)} 징수</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function wageExcludeCheckboxes(){
  return `<div class="studentCheckGrid exclusionBox">${students().map(s=>`<label><input type="checkbox" class="salaryExclude" value="${s.id}"> ${s.name}<span class="small">${studentJobName(s)||""}</span></label>`).join("")||"<span class='small'>학생 없음</span>"}</div>`;
}
function approvedWorkClaimsPayoutHtml(){
  const rows=approvedUnpaidClaims();
  const byStudent={};
  rows.forEach(c=>{
    if(!byStudent[c.studentId]) byStudent[c.studentId]={count:0,total:0,claims:[]};
    byStudent[c.studentId].count++;
    byStudent[c.studentId].total+=money(c.approvedWage);
    byStudent[c.studentId].claims.push(c);
  });
  const summary=Object.entries(byStudent).map(([studentId,x])=>`<tr><td><b>${studentName(studentId)}</b></td><td class="num">${x.count}건</td><td class="num">${won(x.total)}</td><td><button class="green" onclick="payApprovedWorkClaimsForStudent('${studentId}')">학생별 지급</button></td></tr>`).join("");
  const detail=rows.map(c=>`<tr><td>${c.studentName||studentName(c.studentId)}</td><td>${c.workDate||"-"}</td><td>${c.jobName||"-"} / ${c.workTypeName||"-"}</td><td class="num">${won(c.approvedWage)}</td><td><button onclick="paySingleWorkClaim('${c.id}')">건별 지급</button></td></tr>`).join("");
  return `<div class="section">
    <div class="head"><div><h2>승인된 미지급 업무임금</h2><div class="sub">국세청이 승인했고 아직 지급되지 않은 건만 지급합니다.</div></div><button class="primary" onclick="payAllApprovedWorkClaims()" ${rows.length?"":"disabled"}>전체 지급</button></div>
    ${rows.length?`<div class="grid g2"><div class="card"><h3>학생별 합계</h3><div class="scroll"><table><thead><tr><th>학생</th><th class="num">건수</th><th class="num">지급 예정액</th><th>지급</th></tr></thead><tbody>${summary}</tbody></table></div></div><div class="card"><h3>개별 업무기록</h3><div class="scroll"><table><thead><tr><th>학생</th><th>일자</th><th>업무</th><th class="num">임금</th><th>지급</th></tr></thead><tbody>${detail}</tbody></table></div></div></div>`:`<p class="small">승인된 미지급 업무임금이 없습니다.</p>`}
  </div>`;
}
function taxOfficeTeacherWageHtml(){
  const officers=students().filter(s=>studentHasRole(s.id,"tax_office"));
  if(!officers.length) return "";
  const rows=officers.map(s=>{
    const est=taxOfficeWageEstimate(s.id);
    const rec=obj(data.taxOfficeWageRecords)[taxOfficeWageRecordId(s.id,est.day)];
    return `<tr><td><b>${s.name}</b></td><td>${est.day}</td><td class="num">${est.reviewedClaimsCount}</td><td class="num">${est.collectedTaxCasesCount}</td><td class="num">${won(est.collectedTaxAmount)}</td><td class="num"><b>${won(est.total)}</b></td><td>${rec?`<span class="pill green">지급완료</span>`:`<button class="green" onclick="payTaxOfficeWage('${s.id}')">지급</button>`}</td></tr>`;
  }).join("");
  return `<div class="section"><div class="head"><div><h2>국세청 자동 임금</h2><div class="sub">오늘 심사 처리와 미납 세금 징수 실적으로 자동 산정합니다.</div></div></div><div class="scroll"><table><thead><tr><th>국세청</th><th>기준일</th><th class="num">심사</th><th class="num">징수</th><th class="num">징수액</th><th class="num">예상 임금</th><th>지급</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function renderJobs(){
  const el=document.getElementById("jobs"); if(!el) return;
  el.innerHTML = `
    <div class="section">
      <div class="head"><div><h2>직업표</h2><div class="sub">학생 한 명이 여러 직업을 동시에 가질 수 있습니다. 직업별 정원은 그대로 관리됩니다.</div></div><span class="jobBadge">${jobs().length}개 직업</span></div>
      ${jobTableHtml()}
    </div>
    <div class="section">
      <div class="jobGrid">
        <div class="card">
          <h3>직업 추가</h3>
          <div class="grid g2">
            <div class="field"><label>직업명</label><input id="newJobName" placeholder="예: 우체부"></div>
            <div class="field"><label>임금</label><input id="newJobWage" type="number" value="10"></div>
            <div class="field"><label>지급방식</label><select id="newJobPayType"><option>일당</option><option>건당</option><option>변동 일당</option><option>자율</option></select></div>
            <div class="field"><label>정원</label><input id="newJobSlots" type="number" value="1"></div>
          </div>
          <div class="field"><label>비고</label><input id="newJobNote" placeholder="선택"></div>
          <button class="primary" onclick="addJob()">직업 추가</button>
        </div>
        <div class="card">
          <h3>학생에게 직업 추가</h3>
          <div class="jobAssignBox">
            <div class="field"><label>학생</label><select id="assignStudent">${studentOptions()}</select></div>
            <div class="field"><label>직업</label><select id="assignJob">${jobOptions()}</select></div>
            <button class="blue" onclick="assignSelectedJob()">추가</button>
          </div>
          <p class="small">학생 한 명에게 여러 직업을 추가할 수 있습니다. 같은 직업은 중복 추가되지 않습니다.</p>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="head"><div><h2>학생별 직업 배정표</h2><div class="sub">학생별로 직업을 추가하거나 제거합니다.</div></div></div>
      ${studentJobAssignmentRows()}
    </div>
    <div class="section">
      <div class="head"><div><h2>직업별 권한 관리</h2><div class="sub">경찰·국세청·심판 권한, 신용도, 경고/이의신청 상태를 확인합니다.</div></div></div>
      ${roleAdminPanelHtml()}
    </div>
    <div class="section">
      <div class="head"><div><h2>일괄 임금 지급</h2><div class="sub">직업표 임금 기준 지급은 학생이 보유한 모든 직업의 임금을 합산합니다. 특정 학생은 제외할 수 있습니다.</div></div></div>
      <div class="grid g2">
        <div class="card">
          <h3>지급 설정</h3>
          <div class="field"><label>지급 방식</label><select id="bulkWageMode"><option value="job">직업표 임금 기준</option><option value="fixed">모두 같은 금액</option></select></div>
          <div class="field"><label>공통 금액</label><input id="bulkWageAmount" type="number" value="10"><div class="small">‘모두 같은 금액’ 선택 시 사용됩니다.</div></div>
          <div class="field"><label>내용</label><input id="bulkWageDesc" value="직업 임금 지급"></div>
          <button class="green" onclick="payBulkWages()">일괄 임금 지급</button>
        </div>
        <div class="card">
          <h3>지급 제외 학생</h3>
          ${wageExcludeCheckboxes()}
        </div>
      </div>
    </div>
    ${approvedWorkClaimsPayoutHtml()}
    ${taxOfficeTeacherWageHtml()}`;
}

function transactionStudentTiles(){
  const st=students();
  if(!st.length) return `<div class="mutedBox">등록된 학생이 없습니다.</div>`;
  return `<div class="studentActionGrid">${st.map(s=>`<label class="studentActionTile">
    <input type="checkbox" class="bulkTxStudent" value="${s.id}" onchange="refreshBulkTxSelection()">
    <span class="tileName">${s.name}</span>
    <span class="tileBalance">${won(balanceOf(s.id))}</span>
    <span class="tileJob">${studentJobName(s)||"직업 없음"}</span>
  </label>`).join("")}</div>`;
}
function renderTransactionsDesktop(){
  document.getElementById("transactions").innerHTML = `
    <div class="section"><div class="head"><div><h2>상금 지급·벌금 환수</h2><div class="sub">학생 타일을 클릭해 여러 명을 선택한 뒤 한 번에 처리합니다.</div></div><span id="bulkTxCount" class="pill blue">0명 선택</span></div>
      <div class="bulkTxLayout">
        <div class="card">
          <h3>작업 선택</h3>
          <input id="bulkTxMode" type="hidden" value="pay">
          <div class="txModeBtns">
            <button id="bulkMode_pay" class="active" onclick="setBulkTxMode('pay')">상금 지급</button>
            <button id="bulkMode_collect" onclick="setBulkTxMode('collect')">직접 환수</button>
            <button id="bulkMode_fine" onclick="setBulkTxMode('fine')">벌금 고지서</button>
          </div>
          <div class="field"><label>1인 금액</label><input id="bulkTxAmount" type="number" value="10"></div>
          <div class="field"><label>내용</label><input id="bulkTxDesc" value="수업 보상"></div>
          <div class="toolbar">
            <button onclick="toggleBulkTxStudents(true)">전체 선택</button>
            <button onclick="toggleBulkTxStudents(false)">선택 해제</button>
            <button class="primary" onclick="runBulkStudentTransaction()">일괄 처리</button>
          </div>
          <p class="small">벌금 고지서는 현재 자산 스냅샷으로 금액이 확정되며, 학생이 직접 납부합니다.</p>
        </div>
        <div class="card">
          <h3>학생 선택</h3>
          ${transactionStudentTiles()}
        </div>
      </div>
    </div>
    <div class="section"><div class="head"><div><h2>학생 간 송금</h2><div class="sub">보내는 학생과 받는 학생이 정해진 거래입니다.</div></div></div>
      <div class="grid g3">
        <div class="card"><h3>송금 처리</h3><div class="field"><label>보내는 학생</label><select id="fromStudent">${studentOptions()}</select></div><div class="field"><label>받는 학생</label><select id="toStudent">${studentOptions()}</select></div><div class="field"><label>송금액</label><input id="transferAmount" type="number" value="10"></div><button class="primary" onclick="manualTransfer()">송금 처리</button></div>
        <div class="card"><h3>전체 지급</h3><div class="field"><label>1인당 금액</label><input id="salaryAmount" type="number" value="10"></div><div class="field"><label>내용</label><input id="salaryDesc" value="월급"></div><button class="green" onclick="payAll()">전체 지급</button></div>
      </div>
    </div>
    <div class="section"><div class="head"><div><h2>벌금 고지서 현황</h2><div class="sub">경고 2회 또는 수동 벌금으로 발행된 고지서입니다.</div></div></div>${fineAdminTableHtml()}</div>`;
}

function renderTransactions(){
  if(!isMobileViewport()) return renderTransactionsDesktop();
  if(activeMobileTeacherPage){
    renderTransactionsDesktop();
    document.getElementById("transactions").innerHTML = `${mobileSubPageHeader({
      wage:"임금 지급",ledger:"거래 내역",tax:"세금 관리",fine:"경고/벌금 관리"
    }[activeMobileTeacherPage]||"경제관리","backMobileTeacherPage()")}<div class="mobileTeacherDetail">${document.getElementById("transactions").innerHTML}</div>`;
    return;
  }
  document.getElementById("transactions").innerHTML = `<div class="section"><div class="head"><div><h2>경제관리</h2><div class="sub">임금, 거래, 벌금, 세금을 메뉴로 나눠 처리합니다.</div></div></div>${mobileMenuGrid([
    {id:"wage",icon:"₩",title:"임금 지급",description:"전체 지급과 학생별 송금"},
    {id:"ledger",icon:"≡",title:"거래 내역",description:"최근 거래와 요청 확인"},
    {id:"tax",icon:"%",title:"세금 관리",description:"세금 납부와 국세청 기능"},
    {id:"fine",icon:"!",title:"경고/벌금 관리",description:"벌금 고지와 정리"}
  ].map(c=>({...c,onClick:`openMobileTeacherPage('${c.id}')`})))}</div>`;
}

function renderShopDesktop(){
  document.getElementById("shop").innerHTML = `
    <div class="section"><div class="head"><div><h2>상품·상점</h2><div class="sub">상품 카드를 누르면 가격 차트를 볼 수 있습니다.</div></div></div>
      <div class="grid g4">${arr(data.products).map(p=>`<div class="card" onclick="showProductChart('${p.id}')" style="cursor:pointer"><h3>${product(p.id)?.name||p.name}</h3><div class="value">${won(publicPrice(product(p.id)||p))}</div><div class="sub">${product(p.id)?.note||p.note||""}</div><div class="toolbar"><span class="pill blue">${priceTypeLabel(product(p.id)||p)}</span><button onclick="event.stopPropagation();showProductChart('${p.id}')">차트</button></div></div>`).join("")}</div>
    </div>
    ${snackPriceManageHtml()}
    <div class="section"><div class="head"><div><h2>아바타 상점</h2><div class="sub">학생들이 구매할 수 있는 아바타 아이템입니다. 새 이미지 아바타 ${Object.keys(CUSTOM_AVATARS).length}개 포함.</div></div></div>
      <div class="itemShopGrid">${avatarItemCatalog().map(it=>`<div class="itemCard"><div class="shopThumb">${itemThumb(it)}</div><h4>${it.name}</h4><div class="small"><span class="pill ${rarityPillClass(it.rarity)}">${it.rarity}</span> <span class="pill">${it.type}</span></div><div class="value" style="font-size:22px">${won(cosmeticPrice(it))}</div></div>`).join('')}</div>
    </div>
    <div class="section"><div class="head"><div><h2>미니룸 상점</h2><div class="sub">가구·벽지·바닥 아이템입니다.</div></div></div>
      <div class="itemShopGrid">${roomItemCatalog().map(it=>`<div class="itemCard"><div class="shopThumb">${itemThumb(it)}</div><h4>${it.name}</h4><div class="small"><span class="pill ${rarityPillClass(it.rarity)}">${it.rarity}</span> <span class="pill">${it.type}</span></div><div class="value" style="font-size:22px">${won(cosmeticPrice(it))}</div></div>`).join('')}</div>
    </div>
    <div class="section"><div class="grid g3">
      <div class="card"><h3>도매 구매</h3><div class="field"><label>소매상</label><select id="wholesaleBuyer">${studentOptions()}</select></div><div class="field"><label>상품</label><select id="wholesaleProduct">${productOptions()}</select></div><div class="field"><label>수량</label><input id="wholesaleQty" type="number" value="1"></div><button class="green" onclick="doWholesale()">도매 구매</button></div>
      <div class="card"><h3>소매 구매</h3><div class="field"><label>구매자</label><select id="retailBuyer">${studentOptions()}</select></div><div class="field"><label>소매상</label><select id="retailSeller">${studentOptions()}</select></div><div class="field"><label>상품</label><select id="retailProduct">${productOptions()}</select></div><div class="field"><label>수량</label><input id="retailQty" type="number" value="1"></div><div class="field"><label>개당 판매가</label><input id="retailUnit" type="number" value="10"></div><button class="primary" onclick="manualRetailPurchase()">소매 구매</button></div>
      <div class="card"><h3>재고 현황</h3><div class="scroll" style="max-height:320px"><table><thead><tr><th>학생</th><th>재고</th></tr></thead><tbody>${inventoryRows()}</tbody></table></div></div>
    </div></div>`;
}
function inventoryRows(){
  return students().map(s=>{
    const inv=obj(obj(data.inventories)[s.id]);
    const txt=Object.entries(inv).filter(([_,q])=>n(q)>0).map(([pid,q])=>`${product(pid)?.name||"상품"} ${q}`).join(" / ");
    return `<tr><td>${s.name}</td><td>${txt||"-"}</td></tr>`;
  }).join("") || `<tr><td colspan="2">학생 없음</td></tr>`;
}
function priceTypeLabel(p){
  return p?.priceType==="fixed" ? "고정가" : p?.priceType==="economyIndex" ? "경제지수 연동" : (p?.kind||"가격");
}
function snackPriceManageHtml(){
  const rows=arr(data.products).map(raw=>{
    const p=product(raw.id)||raw;
    return `<tr>
      <td><b>${p.name}</b><br><span class="small">${p.note||""}</span></td>
      <td><select id="snack_${p.id}_priceType"><option value="fixed" ${p.priceType==="fixed"?"selected":""}>fixed</option><option value="economyIndex" ${p.priceType==="economyIndex"?"selected":""}>economyIndex</option></select></td>
      <td><input id="snack_${p.id}_fixedPrice" type="number" value="${n(p.fixedPrice)}"></td>
      <td><input id="snack_${p.id}_basePrice" type="number" value="${n(p.basePrice)}"></td>
      <td><input id="snack_${p.id}_baseEconomyIndex" type="number" value="${n(p.baseEconomyIndex)||100}"></td>
      <td><input id="snack_${p.id}_sensitivity" type="number" step="0.1" value="${n(p.sensitivity)||1}"></td>
      <td><input id="snack_${p.id}_minPrice" type="number" value="${n(p.minPrice)||1}"></td>
      <td><input id="snack_${p.id}_maxPrice" type="number" value="${p.maxPrice??""}"></td>
      <td><input id="snack_${p.id}_wholesaleRate" type="number" step="0.01" value="${n(p.wholesaleRate)||0.65}"></td>
      <td class="num">${won(productPrice(p))}<br><span class="small">도매 ${won(productWholesalePrice(p))}</span></td>
    </tr>`;
  }).join("");
  return `<div class="section"><div class="head"><div><h2>과자 가격 관리</h2><div class="sub">소비자가와 도매가는 같은 가격 계산 함수를 사용합니다. 현재 경제지수: ${won(snackEconomyIndex())}</div></div><button class="primary" onclick="saveSnackProductPrices()">저장</button></div>
    <div class="scroll"><table><thead><tr><th>상품</th><th>priceType</th><th>fixedPrice</th><th>basePrice</th><th>baseEconomyIndex</th><th>sensitivity</th><th>minPrice</th><th>maxPrice</th><th>wholesaleRate</th><th class="num">미리보기</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
function industryInventoryText(studentId){
  const mat=industryMaterials().filter(item=>industryQty(studentId,item.id)>0).map(item=>`${item.name} ${industryQty(studentId,item.id)}`).join(" / ");
  const prod=industryProducts().filter(item=>industryQty(studentId,item.id)>0).map(item=>`${item.name} ${industryQty(studentId,item.id)}`).join(" / ");
  return `<b>재료</b>: ${mat||"-"}<br><b>완제품</b>: ${prod||"-"}`;
}
function industryStudentRows(){
  return students().map(s=>{
    const action=industryActionState(s.id);
    const actionText=action?.action ? `${INDUSTRY_ACTION_LABELS[action.action]||action.action} ${n(action.count)}회` : "-";
    return `<tr><td><b>${s.name}</b></td><td>${industryRoleName(s.id)}</td><td>${industryInventoryText(s.id)}</td><td>${actionText}</td><td><button onclick="resetStudentIndustryRole('${s.id}')">직업 초기화</button> <button class="danger" onclick="resetStudentIndustryInventory('${s.id}')">재고 초기화</button></td></tr>`;
  }).join("") || `<tr><td colspan="5">학생 없음</td></tr>`;
}
function renderIndustryTeacher(){
  document.getElementById("industry").innerHTML = `
    <div class="section"><div class="head"><div><h2>산업 관리</h2><div class="sub">생산·제작 전용 직업, 재료, 완제품, 학생별 재고를 확인합니다.</div></div></div>
      <div class="grid g3">${industryRoles().map(role=>`<div class="card"><h3>${role.name}</h3><div class="sub">${role.description}</div><p class="small">선택비 ${won(role.fee)} · 생산 분야 ${role.category}</p></div>`).join("")}</div>
    </div>
    <div class="section"><div class="head"><div><h2>재료 목록</h2><div class="sub">재료 생산비와 담당 산업 직업입니다.</div></div></div>
      <div class="scroll"><table><thead><tr><th>재료</th><th>분류</th><th>직업</th><th class="num">생산비</th><th>설명</th></tr></thead><tbody>${industryMaterials().map(item=>`<tr><td><b>${item.name}</b></td><td>${item.category}</td><td>${industryRole(item.role)?.name||item.role}</td><td class="num">${won(item.productionCost)}</td><td>${item.description||""}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <div class="section"><div class="head"><div><h2>완제품 레시피</h2><div class="sub">기본 생산비 기준 원가 참고입니다.</div></div></div>
      <div class="scroll"><table><thead><tr><th>완제품</th><th>필요 재료</th><th class="num">제조비</th><th class="num">기본 원가</th><th>설명</th></tr></thead><tbody>${industryProducts().map(item=>`<tr><td><b>${item.name}</b></td><td>${industryRecipeText(item)}</td><td class="num">${won(item.manufactureCost)}</td><td class="num">${won(industryProductBaseCost(item))}</td><td>${item.description||""}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <div class="section"><div class="head"><div><h2>학생별 산업 현황</h2><div class="sub">일반 잔고와 거래장부는 건드리지 않고 산업 데이터만 관리합니다.</div></div></div>
      <div class="toolbar"><button class="orange" onclick="resetTodayIndustryActions()">오늘 산업 행동 잠금 초기화</button><button class="danger" onclick="resetAllIndustryInventories()">전체 산업 재고 초기화</button></div>
      <div class="scroll"><table><thead><tr><th>학생</th><th>산업 직업</th><th>산업 재고</th><th>오늘 행동</th><th>관리</th></tr></thead><tbody>${industryStudentRows()}</tbody></table></div>
    </div>`;
}

function renderTickets(){
  document.getElementById("tickets").innerHTML = `
    <div class="section"><div class="head"><div><h2>티켓 시장</h2><div class="sub">티켓 가격과 구매/판매를 처리합니다.</div></div></div>
      ${ticketPriceSummaryCardsHtml()}
      <div class="grid g3">${Object.keys(ticketMeta).map(k=>ticketCard(k)).join("")}</div>
    </div>
    <div class="section"><div class="head"><div><h2>최근 5일 티켓 가격표</h2><div class="sub">날짜별 가격과 등락률을 크게 표시합니다.</div></div></div>${recentTicketPriceTableHtml(5)}</div>
    <div class="section"><div class="grid g2">
      <div class="card"><h3>티켓 구매</h3><div class="field"><label>학생</label><select id="ticketBuyer">${studentOptions()}</select></div><div class="field"><label>티켓</label><select id="ticketBuyKind">${ticketOptions()}</select></div><button class="blue" onclick="manualTicketBuy()">구매 처리</button></div>
      <div class="card"><h3>티켓 판매</h3><div class="field"><label>학생</label><select id="ticketSeller">${studentOptions()}</select></div><div class="field"><label>티켓</label><select id="ticketSellKind">${ticketOptions()}</select></div><button class="green" onclick="manualTicketSell()">판매 처리</button></div>
    </div></div>`;
}
function ticketCard(k){
  const t=ticketData(k), m=ticketMeta[k]||{name:k,color:"#64748b",formula:""};
  const info=ticketPriceInfo(k);
  const buyInfo=ticketBuyPriceInfo(k);
  const soldRatio=Math.round((n(t.sold)/Math.max(1,n(t.supply)))*100);
  return `<div class="card" style="border-left:9px solid ${m.color}">
    <h3>${m.name}</h3><div class="sub">${m.formula}</div>
    <div class="toolbar"><button onclick="showTicketChart('${k}')">차트</button>${ticketStockHtml(k)}</div>
    <div class="ticketInventoryMeter"><div style="width:${soldRatio}%"></div></div>
    <div class="ticketInventoryText">총 ${n(t.supply)}장 · 판매 ${n(t.sold)}장 · 재고 ${n(t.stock)}장</div>
    <div class="grid g3" style="margin-top:10px">
      <div class="price"><div class="label">기본</div><div class="value">${won(info.base)}</div></div>
      <div class="price buy"><div class="label">구매가</div><div class="value">${won(buyInfo.close)}</div></div>
      <div class="price sell"><div class="label">판매가</div><div class="value">${won(info.close)}</div></div>
    </div>
    <div class="ticketFormulaMini">전날 대비 ${signedWon(info.change)} · 구매가는 구매 후 재고 기준 · 판매가 재고부족 ${Math.round((info.scarcityMultiplier||1)*100)}% · 구매가 재고부족 ${Math.round((buyInfo.scarcityMultiplier||1)*100)}%</div>
    <div class="field" style="margin-top:10px"><label>총수량</label><input type="number" value="${n(t.supply)}" onchange="updateTicket('${k}','supply',this.value)"></div>
    <div class="field"><label>판매된 수 보정</label><input type="number" value="${n(t.sold)}" onchange="updateTicket('${k}','sold',this.value)"></div>
    <div class="small">현재재고는 총수량 - 판매된 수로 자동 계산됩니다. 구매하면 판매 수가 늘고, 판매/사용하면 재고로 돌아옵니다.</div>
  </div>`;
}

function renderShop(){
  if(!isMobileViewport()) return renderShopDesktop();
  if(activeMobileTeacherPage){
    renderShopDesktop();
    document.getElementById("shop").innerHTML = `${mobileSubPageHeader({
      tickets:"티켓 관리",snacks:"과자 도매 관리",free:"자유시장 관리",approval:"구매 승인 관리"
    }[activeMobileTeacherPage]||"상점/시장","backMobileTeacherPage()")}<div class="mobileTeacherDetail">${document.getElementById("shop").innerHTML}</div>`;
    return;
  }
  document.getElementById("shop").innerHTML = `<div class="section"><div class="head"><div><h2>상점/시장</h2><div class="sub">상품, 도매, 자유시장, 승인 업무를 나눠 봅니다.</div></div></div>${mobileMenuGrid([
    {id:"tickets",icon:"▤",title:"티켓 관리",description:"티켓 가격과 재고 관리"},
    {id:"snacks",icon:"□",title:"과자 도매 관리",description:"상품 가격과 도매 처리"},
    {id:"free",icon:"▦",title:"자유시장 관리",description:"판매글과 시장 상태 확인"},
    {id:"approval",icon:"✓",title:"구매 승인 관리",description:"학생 구매 요청 처리"}
  ].map(c=>({...c,onClick:`openMobileTeacherPage('${c.id}')`})))}</div>`;
}

function renderFinanceDesktop(){
  document.getElementById("finance").innerHTML = `
    <div class="section"><div class="head"><div><h2>예금·채권</h2><div class="sub">채권은 교사가 먼저 발행하고, 학생은 발행 재고 안에서만 구매 신청합니다.</div></div></div>
      <div class="grid g4">
        <div class="card"><h3>예금 입금</h3><div class="field"><label>학생</label><select id="depositStudent">${studentOptions()}</select></div><div class="field"><label>금액</label><input id="depositAmount" type="number" value="100"></div><button class="blue" onclick="depositMoney()">입금</button></div>
        <div class="card"><h3>예금 출금</h3><div class="field"><label>학생</label><select id="withdrawStudent">${studentOptions()}</select></div><div class="field"><label>금액</label><input id="withdrawAmount" type="number" value="100"></div><button class="green" onclick="withdrawMoney()">출금</button></div>
        <div class="card"><h3>예금 이자</h3><div class="field"><label>이자율 %</label><input id="depositRate" type="number" value="${data.settings.depositRate*100}"></div><div class="field"><label>지급 횟수</label><input id="depositInterestPeriods" type="number" min="1" value="1"></div><button class="purple" onclick="payDepositInterest()">전체 지급</button><p class="small">밀린 이자는 횟수를 늘려 소급 지급합니다. 예: 3회분이면 현재 예금에 이자를 3번 복리로 붙입니다.</p></div>
        <div class="card bondIssueCreateCard">
          <h3>채권 발행</h3>
          <div class="field"><label>채권명</label><input id="issueBondName" value="7일 국채"></div>
          <div class="field"><label>1장 가격</label><input id="issueBondPrincipal" type="number" value="100"></div>
          <div class="field"><label>금리 %</label><input id="issueBondRate" type="number" value="${n(data.settings.bondRate)*100}"></div>
          <div class="field"><label>만기일수</label><input id="issueBondDays" type="number" value="${n(data.settings.bondDays)||7}"></div>
          <div class="field"><label>발행 수량</label><input id="issueBondTotal" type="number" value="10"></div>
          <button class="orange" onclick="issueBond()">채권 발행</button>
        </div>
      </div>
    </div>
    <div class="section"><div class="head"><div><h2>예금 가입 현황</h2><div class="sub">현재 예금 잔액이 있는 학생과 1회 예상 이자를 확인하고, 학생별로 이자를 지급합니다.</div></div></div>${depositHoldingRowsHtml()}</div>
    <div class="section"><div class="head"><div><h2>적금 가입 현황</h2><div class="sub">가입 중인 적금의 만기일, 현재 평가액, 발생 이자를 확인하고 상품별로 이자를 수동 지급합니다.</div></div></div>${savingsHoldingRowsHtml()}</div>
    <div class="section"><div class="head"><div><h2>발행 채권 재고</h2><div class="sub">학생은 아래 발행 채권 중 남은 재고가 있는 것만 구매할 수 있습니다.</div></div></div>${bondIssueTableHtml()}</div>
    <div class="section"><div class="head"><h2>학생 보유 채권 목록</h2><button class="primary" onclick="matureDueBonds()">만기 지난 채권 일괄 처리</button></div>
      <div class="scroll"><table><thead><tr><th>소유자</th><th>채권명</th><th class="num">원금</th><th class="num">금리</th><th>만기일</th><th>상태</th><th>처리</th></tr></thead><tbody>
      ${arr(data.bonds).map(bondRow).join("") || `<tr><td colspan="7">채권 없음</td></tr>`}
      </tbody></table></div>
    </div>`;
}
function renderFinance(){
  if(!isMobileViewport()) return renderFinanceDesktop();
  if(activeMobileTeacherPage){
    renderFinanceDesktop();
    document.getElementById("finance").innerHTML = `${mobileSubPageHeader({
      deposit:"예금 관리",savings:"적금 관리",bonds:"채권 관리",rates:"금리 설정"
    }[activeMobileTeacherPage]||"예금·채권","backMobileTeacherPage()")}<div class="mobileTeacherDetail">${document.getElementById("finance").innerHTML}</div>`;
    return;
  }
  const activeBonds=arr(data.bonds).filter(b=>b.status==="active").length;
  document.getElementById("finance").innerHTML = `<div class="section"><div class="head"><div><h2>예금·채권</h2><div class="sub">예금, 적금, 채권 업무를 메뉴로 나눠 처리합니다.</div></div></div>${mobileMenuGrid([
    {id:"deposit",icon:"◇",title:"예금 관리",description:"입금, 출금, 이자 지급"},
    {id:"savings",icon:"▣",title:"적금 관리",description:"가입 현황과 만기 처리"},
    {id:"bonds",icon:"◌",title:"채권 관리",description:"발행, 보유, 만기 처리",badge:`활성 ${activeBonds}`},
    {id:"rates",icon:"%",title:"금리 설정",description:"예금/채권 금리 확인"}
  ].map(c=>({...c,onClick:`openMobileTeacherPage('${c.id}')`})))}</div>`;
}

function bondIssueTableHtml(){
  const rows=arr(data.bondIssues).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  if(!rows.length) return `<p class="small">아직 발행한 채권이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>채권명</th><th class="num">1장 가격</th><th class="num">금리</th><th class="num">만기</th><th class="num">재고</th><th>상태</th><th>처리</th></tr></thead><tbody>${rows.map(i=>`<tr>
    <td>${bondIssueName(i)}</td>
    <td class="num">${won(i.principal)}</td>
    <td class="num">${n(i.rate)}%</td>
    <td class="num">${n(i.days)}일</td>
    <td class="num">${n(i.remaining)} / ${n(i.total)}장</td>
    <td><span class="pill ${(i.status||"active")==="active"?"green":"red"}">${(i.status||"active")==="active"?"판매중":"판매중지"}</span></td>
    <td><button onclick="toggleBondIssue('${i.id}')">${(i.status||"active")==="active"?"중지":"재개"}</button> <button class="red" onclick="deleteBondIssue('${i.id}')">삭제</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}
function bondRow(b){
  const due=new Date(b.mature+"T00:00:00")<=new Date();
  return `<tr><td>${studentName(b.owner)}</td><td>${b.issueName||"채권"}</td><td class="num">${won(b.principal)}</td><td class="num">${b.rate}%</td><td>${b.mature}</td><td><span class="pill ${b.status==="active"?(due?"orange":"blue"):"green"}">${b.status==="active"?(due?"만기 도래":"진행중"):"완료"}</span></td><td>${b.status==="active"?`<button class="green" onclick="matureBond('${b.id}')">만기</button> <button onclick="earlyCancelBond('${b.id}')">중도해지</button>`:"-"}</td></tr>`;
}

function ledgerStudentParticipants(e){
  return [...new Set(arr(e.lines).map(l=>l.account).filter(id=>id!==CENTRAL && student(id)))];
}
function isStudentTradeLedger(e){
  if(!e || e.type==="거래세") return false;
  return ledgerStudentParticipants(e).length>=2;
}
function ledgerTaxPaid(e){
  const meta=obj(e.meta);
  if(meta.taxPaid===false) return false;
  return meta.taxPaid===true || meta.taxCharged===true || n(meta.tax)>0;
}
function taxableLedgerLines(e){
  if(!e || e.type==="거래세") return [];
  if(obj(e.meta).taxCharged || n(obj(e.meta).tax)>0) return [];
  return arr(e.lines).filter(l=>l.account!==CENTRAL && n(l.delta)>0).map(l=>({account:l.account,base:n(l.delta),amount:tax(n(l.delta))})).filter(l=>l.amount>0);
}
function ledgerTaxButton(e){
  if(!isStudentTradeLedger(e)) return `<span class="small">교사거래 제외</span>`;
  const lines=taxableLedgerLines(e);
  const checked=ledgerTaxPaid(e) ? "checked" : "";
  const toggle=`<label class="taxTradeToggle"><input type="checkbox" ${checked} onchange="setLedgerTaxPaid('${e.id}',this.checked)"> 거래 인정</label>`;
  if(!lines.length) return toggle;
  const total=lines.reduce((a,l)=>a+l.amount,0);
  return `<div class="taxControl">${toggle}<button class="orange" onclick="chargeLedgerTax('${e.id}')">세금 ${won(total)}</button></div>`;
}
function tradeKingRows(day=today()){
  const scores={};
  ledgerForDay(day).forEach(e=>{
    if(!isStudentTradeLedger(e) || !ledgerTaxPaid(e)) return;
    const participants=ledgerStudentParticipants(e);
    participants.forEach(id=>{
      if(!scores[id]) scores[id]={id,count:0,volume:0};
      scores[id].count+=1;
      scores[id].volume+=arr(e.lines).filter(l=>l.account===id).reduce((sum,l)=>sum+Math.abs(n(l.delta)),0);
    });
  });
  return Object.values(scores).sort((a,b)=>b.count-a.count || b.volume-a.volume || studentName(a.id).localeCompare(studentName(b.id),"ko"));
}
function tradeKingTableHtml(day=today()){
  const rows=tradeKingRows(day);
  if(!rows.length) return `<p class="small">오늘 세금 납부/거래 인정된 학생 간 거래가 없습니다.</p>`;
  return `<div class="tradeKingGrid">${rows.slice(0,10).map((r,i)=>`<div class="tradeKingCard ${i===0?'top':''}">
    <div class="tradeRank">${i+1}</div>
    <div><b>${studentName(r.id)}</b><div class="small">거래 ${r.count}회 · 거래액 ${won(r.volume)}</div></div>
  </div>`).join("")}</div>`;
}
function renderLedger(){
  const entries=[...(derived.ledger || [])].sort((a,b)=>(b.ts||"").localeCompare(a.ts||"")).slice(0,300);
  document.getElementById("ledger").innerHTML = `
    <div class="section"><div class="head"><div><h2>오늘 거래왕</h2><div class="sub">세금 납부/거래 인정된 학생 간 거래만 집계합니다.</div></div></div>${tradeKingTableHtml()}</div>
    <div class="section"><div class="head"><div><h2>거래장부</h2><div class="sub">최근 300건을 먼저 표시합니다. 모든 잔고 계산은 전체 장부를 기준으로 유지됩니다.</div></div><span class="pill blue">전체 ${derived.ledger.length}건</span></div><div class="scroll"><table><thead><tr><th>시간</th><th>종류</th><th>내용</th><th>변동</th><th>세금/거래인정</th></tr></thead><tbody>${entries.map(e=>`<tr><td>${seoulDateTimeText(e.ts)}</td><td><span class="pill">${e.type}</span></td><td>${e.desc}</td><td>${arr(e.lines).map(l=>`${studentName(l.account)} ${l.delta>0?"+":""}${won(l.delta)}`).join("<br>")}</td><td>${ledgerTaxButton(e)}</td></tr>`).join("") || `<tr><td colspan="5">거래 없음</td></tr>`}</tbody></table></div></div>`;
}

function firstTicketKey(){ return Object.keys(ticketMeta)[0] || "classClean"; }
function safeHistoryTableHtml(){
  try { return historyTableHtml(); }
  catch(e){ console.error("history table error", e); return `<p class="small">가격 기록 표를 불러오지 못했습니다: ${e.message}</p>`; }
}
function ticketChangeBadge(info){
  const up=n(info.change)>=0;
  return `<span class="ticketChange ${up?'up':'down'}">${up?'▲':'▼'} ${signedWon(info.change)} / ${pct(info.changeRate)}</span>`;
}
function ticketPriceSummaryCardsHtml(){
  const stats=currentEconomyStats(today());
  const keys=["personalClean","classClean","playHour"].filter(k=>ticketMeta[k]);
  return `<div class="ticketCurrentGrid">${keys.map(k=>{
    const info=stats.ticketPrices[k] || ticketPriceInfo(k);
    return `<div class="ticketCurrentCard" style="--ticket-color:${ticketMeta[k].color}">
      <span>${ticketMeta[k].name}</span>
      <b>${won(info.close)}</b>
      ${ticketChangeBadge(info)}
      <em>구매 ${info.buyOrders}명 · 판매 ${info.sellOrders}명</em>
    </div>`;
  }).join("")}</div>`;
}
function recentTicketPriceTableHtml(limit=5){
  const keys=["personalClean","classClean","playHour"].filter(k=>ticketMeta[k]);
  const rows=economyHistoryRows(limit).filter(r=>r.ticketPrices);
  if(!rows.length) return `<p class="small">최근 티켓 가격 기록이 아직 없습니다.</p>`;
  return `<div class="recentTicketTable"><table><thead><tr><th>날짜</th>${keys.map(k=>`<th>${ticketMeta[k].name}</th>`).join("")}</tr></thead><tbody>${rows.slice(-limit).map(r=>`<tr>
    <td><b>${r.day.slice(5).replace("-","/")}</b></td>
    ${keys.map(k=>{
      const info=obj(r.ticketPrices)[k] || {};
      return `<td><b>${won(info.close)}</b><br><span class="${n(info.change)>=0?'upText':'downText'}">${n(info.change)>=0?'▲':'▼'} ${pct(info.changeRate)}</span></td>`;
    }).join("")}
  </tr>`).join("")}</tbody></table></div>`;
}



function cosmeticPriceManageHtml(){
  const items=allCosmeticItems();
  if(!items.length) return `<p class="small">등록된 치장템이 없습니다.</p>`;
  return `<div class="priceManageGrid">${items.map(it=>`<div class="priceManageCard">
    <div class="row"><div><b>${it.icon||"■"} ${it.name}</b><br><span class="small">${it.type} / 기본 ${won(it.price||500)}</span></div><input id="cosPrice_${it.id}" type="number" value="${cosmeticPrice(it)}"></div>
  </div>`).join("")}</div>`;
}

let avatarManageHtml;
function avatarCreatorOptions(selected=""){
  return `<option value="">제작자 없음</option>` + students().map(s=>`<option value="${s.id}" ${s.id===selected?"selected":""}>${s.name}</option>`).join("");
}
function avatarManagerId(raw){
  const base=String(raw||"").trim().toLowerCase().replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,"");
  return base || `avatar_${Date.now().toString(36)}`;
}
avatarManageHtml = function(){
  const items=avatarItemCatalog(true);
  return `<div class="avatarManageLayout">
    <div class="card avatarAddCard">
      <h3>새 아바타 등록</h3>
      <div class="field"><label>아바타 ID</label><input id="newAvatarId" placeholder="예: avatar_minji_01"></div>
      <div class="field"><label>이름</label><input id="newAvatarName" placeholder="아바타 이름"></div>
      <div class="field"><label>이미지 URL</label><input id="newAvatarSrc" placeholder="https://... 로 시작하는 이미지 주소"></div>
      <div class="grid g2">
        <div class="field"><label>가격</label><input id="newAvatarPrice" type="number" value="300"></div>
        <div class="field"><label>등급</label><input id="newAvatarRarity" value="일반"></div>
      </div>
      <div class="field"><label>제작 학생</label><select id="newAvatarCreator">${avatarCreatorOptions()}</select></div>
      <button class="primary" onclick="addManagedAvatar()">아바타 등록</button>
      <p class="small">Spark 요금제에서는 파일 업로드 대신 이미지 URL을 붙여넣습니다. 이미지가 인터넷에 공개되어 있으면 학교 컴퓨터에서도 바로 보입니다.</p>
    </div>
    <div class="card avatarCreatorCard">
      <h3>제작자 수익 연결</h3>
      <div class="scroll" style="max-height:420px"><table><thead><tr><th>아바타</th><th>이미지 URL</th><th>가격</th><th>제작자</th><th>상점 표시</th><th>관리</th></tr></thead><tbody>${items.map(it=>`<tr>
        <td><div class="avatarManageItem">${itemThumb(it)}<div><b>${it.name}</b><br><span class="small">${it.id}</span>${avatarCreatorLineHtml(it)}</div></div></td>
        <td><input id="avatarSrc_${it.id}" value="${escapeHtml(it.src||"")}" placeholder="https://... 또는 assets/avatars/..."><button class="compactBtn" onclick="saveAvatarImage('${it.id}')">이미지 저장</button></td>
        <td class="num">${won(cosmeticPrice(it))}</td>
        <td><select id="avatarCreator_${it.id}">${avatarCreatorOptions(avatarCreatorId(it))}</select></td>
        <td><label><input type="checkbox" id="avatarVisible_${it.id}" ${isAvatarHidden(it.id)?"":"checked"} onchange="saveAvatarVisibility('${it.id}',this.checked)"> 표시</label><br><span class="small">${isAvatarHidden(it.id)?"상점에서 숨김":"상점에 표시"}</span></td>
        <td><button onclick="saveAvatarCreator('${it.id}')">저장</button>${isDatabaseAvatar(it.id)?` <button class="danger" onclick="deleteManagedAvatar('${it.id}')">삭제</button>`:""}</td>
      </tr>`).join("") || `<tr><td colspan="6">등록된 아바타가 없습니다.</td></tr>`}</tbody></table></div>
    </div>
  </div>`;
};

function studentScreenVisibilityHtml(){
  const hidden=obj(data.settings?.hiddenStudentTabs);
  const activeForSomeStudent=(tab)=>{
    if(tab.dynamic==="workClaims") return students().some(s=>pieceRateJobsForStudent(s.id).length);
    if(tab.dynamic==="corporations") return students().some(s=>isCorporationAssignedStudent(s.id));
    if(tab.dynamic==="role") return students().some(s=>specialRoleIdsForStudent(s.id).length);
    return true;
  };
  const rows=studentTabCatalog().map(tab=>{
    const visible=studentTabVisible(tab.id);
    const possible=activeForSomeStudent(tab);
    return `<tr>
      <td><b>${tab.icon} ${tab.name}</b><br><span class="small">${tab.note}</span></td>
      <td>${tab.dynamic?`<span class="pill purple">조건부</span>`:`<span class="pill blue">공통</span>`}</td>
      <td>${possible?`<span class="pill green">표시 대상 있음</span>`:`<span class="pill orange">현재 대상 없음</span>`}</td>
      <td>${visible?`<span class="pill green">학생 화면 표시</span>`:`<span class="pill red">숨김</span>`}</td>
      <td>${tab.id==="dashboard"?`<span class="small">기본 화면</span>`:`<button class="${visible?"orange":"green"}" onclick="setStudentTabVisibility('${tab.id}',${visible?false:true})">${visible?"숨기기":"표시하기"}</button>`}</td>
    </tr>`;
  }).join("");
  return `<div class="scroll"><table><thead><tr><th>학생 메뉴</th><th>종류</th><th>대상</th><th>현재 상태</th><th>처리</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSettingsBasicFallback(msg=""){
  const el=document.getElementById("settings");
  if(!el) return;
  el.innerHTML = `<div class="section"><h2>설정</h2>${msg?`<p class="small">설정 화면 일부 오류: ${msg}</p>`:""}<div class="grid g3" style="margin-top:12px">
    <div class="card"><label>전날 총소득</label><input id="setPrev" type="number" value="${n(data.previousIncome)}"></div>
    <div class="card"><label>거래세율 %</label><input id="setTax" type="number" value="${n(data.settings?.taxRate)*100}"></div>
    <div class="card"><label>벌금율 %</label><input id="setFine" type="number" value="${n(data.settings?.fineRate)*100}"></div>
    <div class="card"><label>최소 벌금</label><input id="setFineMin" type="number" value="${n(data.settings?.fineMin)||10}"></div>
    <div class="card"><label>최대 벌금</label><input id="setFineMax" type="number" value="${n(data.settings?.fineMax)||0}"><div class="small">0이면 1인당 평균 보유량 ÷ 5</div></div>
    <div class="card"><label>채권 만기일</label><input id="setBondDays" type="number" value="${n(data.settings?.bondDays)}"></div>
    <div class="card"><label>예금 이자율 %</label><input id="setDepositRate" type="number" value="${n(data.settings?.depositRate)*100}"></div>
    <div class="card"><label>아바타 제작자 수익률 %</label><input id="setAvatarCreatorRate" type="number" value="${avatarCreatorPercent()}"></div>
  </div><div class="toolbar"><button class="primary" onclick="saveSettings()">설정 저장</button><button class="blue" onclick="repairTickets()">티켓 구조 복구</button><button class="danger" onclick="resetAll()">전체 초기화</button></div></div>`;
}

function renderSettings(){
  try {
    renderSettingsUnsafe();
  } catch(e) {
    console.error("settings render error", e);
    renderSettingsBasicFallback(e?.message || String(e));
  }
}
function renderSettingsUnsafe(){
  const s = data.settings || {};
  const firstKey = firstTicketKey();
  const el = document.getElementById("settings");
  if(!el) return;
  el.innerHTML = `<div class="section">
    <h2>설정</h2>
    <div class="grid g3" style="margin-top:12px">
      <div class="card"><label>전날 총소득</label><input id="setPrev" type="number" value="${n(data.previousIncome)}"></div>
      <div class="card"><label>거래세율 %</label><input id="setTax" type="number" value="${n(s.taxRate)*100}"></div>
      <div class="card"><label>벌금율 %</label><input id="setFine" type="number" value="${n(s.fineRate)*100}"></div>
      <div class="card"><label>최소 벌금</label><input id="setFineMin" type="number" value="${n(s.fineMin)||10}"></div>
      <div class="card"><label>최대 벌금</label><input id="setFineMax" type="number" value="${n(s.fineMax)||0}"><div class="small">0이면 1인당 평균 보유량 ÷ 5</div></div>
      <div class="card"><label>채권 만기일</label><input id="setBondDays" type="number" value="${n(s.bondDays)}"></div>
      <div class="card"><label>예금 이자율 %</label><input id="setDepositRate" type="number" value="${n(s.depositRate)*100}"></div>
      <div class="card"><label>아바타 제작자 수익률 %</label><input id="setAvatarCreatorRate" type="number" value="${avatarCreatorPercent()}"></div>
    </div>
    <div class="toolbar">
      <button class="primary" onclick="saveSettings()">설정 저장</button>
      <button class="blue" onclick="repairTickets()">티켓 구조 복구</button>
      <button class="orange" onclick="resetEconomyOnly()">학생 유지 경제 데이터 초기화</button>
      <button class="danger" onclick="resetAll()">전체 초기화</button>
    </div>
    <div class="expireNotice"><b>학생 유지 경제 데이터 초기화</b>: 학생 이름, PIN, 직업, 아바타, 미니룸, 치장템 가격은 유지하고 잔고·거래장부·예금·채권·보유상품·보유티켓·신청·시장매물·가격기록만 초기화합니다.</div>
    <div class="card" style="margin-top:12px"><h3>앱 업데이트</h3><p class="small">배포 후 화면이 예전 버전이면 인터넷 기록을 지우거나 앱을 삭제하지 말고 이 버튼만 누르세요.</p><button class="blue" onclick="window.forceAppUpdate ? window.forceAppUpdate() : location.reload()">최신 버전 다시 불러오기</button></div>
    <p class="small">중요: 지금 버전은 PIN을 화면에서 확인하는 간단 버전입니다. 실제 보안 로그인은 다음 단계에서 Firebase Authentication으로 바꿔야 합니다.</p>
  </div>

  <div class="section">
    <div class="head"><div><h2>아바타 등록·제작자 수익</h2><div class="sub">이미지 URL을 입력해 아바타를 추가하고, 판매 시 제작 학생에게 ${avatarCreatorPercent()}%를 자동 지급합니다.</div></div></div>
    ${avatarManageHtml()}
  </div>

  <div class="section">
    <div class="head"><div><h2>학생 화면 표시 현황</h2><div class="sub">학생 화면에 보이는 메뉴를 확인하고 숨기거나 다시 표시합니다.</div></div></div>
    ${studentScreenVisibilityHtml()}
  </div>

  <div class="section">
    <div class="head"><div><h2>날짜별 가격 기록 수동 추가</h2><div class="sub">원래 데이터나 과거 가격을 직접 넣으면 상품 캔들차트와 티켓 차트에 반영됩니다. 같은 날짜에 여러 번 넣으면 그날의 시가·고가·저가·종가가 만들어집니다.</div></div></div>
    <div class="grid g3">
      <div class="card">
        <h3>상품 가격 기록 추가</h3>
        <div class="field"><label>날짜</label><input id="manualProductDate" type="date" value="${today()}"></div>
        <div class="field"><label>상품</label><select id="manualProductId">${productOptions()}</select></div>
        <div class="field"><label>가격</label><input id="manualProductPrice" type="number" value="100"></div>
        <button class="primary" onclick="addManualProductPrice()">상품 가격 기록 추가</button>
      </div>
      <div class="card">
        <h3>티켓 가격 기록 추가</h3>
        <div class="field"><label>날짜</label><input id="manualTicketDate" type="date" value="${today()}"></div>
        <div class="field"><label>티켓</label><select id="manualTicketId" onchange="fillManualTicketPrices()">${ticketOptions()}</select></div>
        <div class="field"><label>기준가</label><input id="manualTicketBase" type="number" value="${basePrice(firstKey)}"></div>
        <div class="field"><label>구매가</label><input id="manualTicketBuy" type="number" value="${ticketBuy(firstKey)}"></div>
        <div class="field"><label>판매가</label><input id="manualTicketSell" type="number" value="${ticketSell(firstKey)}"></div>
        <button class="orange" onclick="addManualTicketPrice()">티켓 가격 기록 추가</button>
      </div>
      <div class="card">
        <h3>경제지수 기준 가격 자동 기록</h3>
        <div class="field"><label>날짜</label><input id="incomePriceDate" type="date" value="${today()}"></div>
        <div class="field"><label>해당일 경제지수</label><input id="incomePriceValue" type="number" value="${snackEconomyIndex()}"></div>
        <button class="green" onclick="addIncomeBasedPriceHistory()">경제지수로 상품 가격 자동 기록</button>
        <p class="small">입력한 경제지수를 기준으로 경제지수 연동 상품 가격을 자동 계산해 기록합니다.</p>
      </div>
    </div>
    <div class="toolbar"><button onclick="recordSnapshot()">현재 가격 전체 기록 저장</button><button class="danger" onclick="clearPriceHistory()">가격 기록 전체 삭제</button></div>
    <h3>가격 기록</h3>
    ${safeHistoryTableHtml()}
  </div>
  <div class="section">
    <div class="head"><div><h2>치장템 가격 관리</h2><div class="sub">아바타와 미니룸 가격을 직접 설정합니다. 비워두지 말고 숫자로 저장하세요.</div></div></div>
    ${cosmeticPriceManageHtml()}
    <div class="toolbar"><button class="primary" onclick="saveCosmeticPrices()">치장템 가격 저장</button><button onclick="resetCosmeticPrices()">기본 가격으로 되돌리기</button></div>
  </div>
  `;
}

function mobileMoreStudentHtml(id){
  if(isMobileViewport() && activeMobilePage && activeMobilePage.startsWith("peer_")){
    return mobileRankStudentHomeHtml(activeMobilePage.slice(5));
  }
  const pages={
    profile:["내 정보",studentSettingsHtml(id)],
    assets:["자산 구성",`<div class="section"><div class="head"><div><h2>자산 구성</h2><div class="sub">현금, 예금, 채권, 상품을 한눈에 봅니다.</div></div></div>${assetPieHtml(id)}${studentSummaryCardsHtml(id)}</div>`],
    rank:["순위",visitHtml()],
    avatar:["아바타 상점",cosmeticShopHtml(id)],
    room:["미니룸",miniRoomGalleryHtml(id)],
    job:["직업 업무",industryHtml(id)],
    work:["업무 임금 신청",studentWorkClaimsHtml(id)],
    corp:["법인 업무",corporationStudentHtml(id)],
    settings:["설정",studentSettingsHtml(id)],
    help:["도움말",`<div class="section"><div class="head"><div><h2>도움말</h2><div class="sub">경제교실 규칙과 사용법을 확인합니다.</div></div></div><div class="card"><p>경제지수, 거래, 예금, 시장 기능 설명을 열어볼 수 있습니다.</p><button class="primary" onclick="showEconomyHelp()">경제교실 도움말 열기</button></div></div>`]
  };
  if(activeMobilePage && pages[activeMobilePage]) return `${mobileSubPageHeader(pages[activeMobilePage][0])}${pages[activeMobilePage][1]}`;
  const cards=[
    {id:"profile",icon:"person",title:"내 정보",description:"프로필과 신청 내역"},
    {id:"assets",icon:"pie_chart",title:"자산 구성",description:"자산 그래프와 요약",badge:won(totalAssetsOf(id))},
    {id:"rank",icon:"leaderboard",title:"순위·구경",description:"개인/법인 순위와 친구 보기"},
    {id:"avatar",icon:"face",title:"아바타",description:"상점과 보유 아바타"},
    {id:"room",icon:"chair",title:"미니룸",description:"내 방 꾸미기"},
    {id:"job",icon:"work",title:"직업",description:"생산·제작·직업 기능"},
    ...(pieceRateJobsForStudent(id).length?[{id:"work",icon:"◇",title:"업무 임금",description:"성과급 업무 제출"}]:[]),
    ...(isCorporationAssignedStudent(id)?[{id:"corp",icon:"▥",title:"법인 업무",description:"법인 계정 관리"}]:[]),
    {id:"settings",icon:"settings",title:"설정",description:"로그아웃과 전체 내역"},
    {id:"help",icon:"help",title:"도움말",description:"경제교실 안내"}
  ];
  return `<div class="section"><div class="head"><div><h2>메뉴</h2><div class="sub">홈에 두기엔 자잘하지만 필요한 기능을 모았습니다.</div></div></div>${mobileMenuGrid(cards)}</div>`;
}

function renderStudentView(){
  const selected = selectedStudent && student(selectedStudent) ? selectedStudent : "";
  if(!selected){
    document.getElementById("studentView").innerHTML = `
      <div class="exactPixelLoginPage">
        <div class="exactPixelOverlay">
          <div class="exactLoginPanel" aria-label="경제교실 로그인">
            <div class="exactLoginBadge">어서와!</div>
            <h1><span>경제교실</span><br>온라인 운영 사이트</h1>
            <p><b>열매</b>를 모으고, <b>거래</b>하고, <b>성장</b>하는 우리 반 경제</p>
            <div class="exactLoginForm">
              <label>학생 선택</label>
              <select id="loginStudent">${studentOptions()}</select>
              <label>PIN</label>
              <input id="loginPin" type="password" placeholder="예) 1234" onkeydown="if(event.key==='Enter') studentLogin()">
            </div>
            <div class="exactLoginButtons">
              <button class="exactStudentBtn" onclick="studentLogin()"><span>👦</span> 학생 로그인 <b>›</b></button>
              <button class="exactTeacherBtn" onclick="askTeacherPassword()"><span>👨‍🏫</span> 교사용 화면 <b>›</b></button>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }
  const s=student(selected);
  if(studentTab==="assets") studentTab="dashboard";
  if(studentTab==="tickets") studentTab="products";
  const activeTab = studentNavItems().some(([id])=>id===studentTab) ? studentTab : "dashboard";
  if(activeTab!==studentTab){studentTab=activeTab; localStorage.setItem("studentTab",studentTab);}
  const body = studentTab==="dashboard" ? studentDashboardHtml(selected)
    : studentTab==="noticeboard" ? noticeboardStudentHtml(selected)
    : studentTab==="market" ? marketHtml(selected)
    : studentTab==="industry" ? industryHtml(selected)
    : studentTab==="workClaims" ? studentWorkClaimsHtml(selected)
    : studentTab==="corporations" ? corporationStudentHtml(selected)
    : studentTab==="role" ? roleWorkHtml(selected)
    : studentTab==="room" ? miniRoomGalleryHtml(selected)
    : studentTab==="cosmetic" ? cosmeticShopHtml(selected)
    : studentTab==="products" ? shopAndTicketStudentHtml(selected)
    : studentTab==="finance" ? financeStudentHtml(selected)
    : studentTab==="more" ? mobileMoreStudentHtml(selected)
    : studentTab==="visit" ? visitHtml()
    : studentTab==="settings" ? studentSettingsHtml(selected)
    : studentDashboardHtml(selected);
  document.getElementById("studentView").innerHTML = `
    <div class="tabletAppShell">
      ${studentSideNavHtml(studentTab)}
      <div class="tabletMain">
        ${isMobileViewport()?"":studentAppHeaderHtml(s,selected)}
        ${isMobileViewport()?"":studentTabsHtml(studentTab)}
        <div class="tabletContent">${body}</div>
        ${isMobileViewport()?studentTabsHtml(studentTab):""}
      </div>
    </div>`;
}
function myRequests(id){
  const list=arr(data.requests).filter(r=>r.studentId===id).sort((a,b)=>b.ts.localeCompare(a.ts));
  if(!list.length) return `<p class="small">대기 중인 신청이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>시간</th><th>신청</th><th>내용</th><th>취소</th></tr></thead><tbody>${list.map(r=>`<tr><td>${seoulDateTimeText(r.ts)}</td><td>${requestTypeName(r.type)}</td><td>${requestDesc(r)}</td><td><button class="requestCancelBtn" onclick="cancelRequest('${r.id}')">취소</button></td></tr>`).join("")}</tbody></table></div>`;
}



window.submitWorkClaim = async function(){
  const studentId=selectedStudent;
  if(!studentId) return toast("학생 로그인이 필요합니다.");
  const raw=document.getElementById("workClaimRule")?.value || "";
  const [jobId,workType]=raw.split("::");
  const j=job(jobId);
  if(!j || !studentHasJob(student(studentId),jobId) || !isPieceRateJob(j)) return toast("제출 가능한 건당 지급 직업이 아닙니다.");
  const rule=jobWageRulesForJob(jobId).find(r=>String(r.workType||r.id||"default")===String(workType||"default"));
  if(!rule) return toast("업무 종류를 확인하세요.");
  const situation=document.getElementById("workClaimSituation")?.value.trim() || "";
  if(!situation) return toast("상황 설명을 입력하세요.");
  const id="wc_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  const at=new Date().toISOString();
  await dbSet("workClaims/"+id,{
    id,studentId,studentName:studentName(studentId),jobId,jobName:j.name,
    workType:rule.workType||rule.id||"default",workTypeName:rule.workTypeName||rule.name||"업무",
    workDate:document.getElementById("workClaimDate")?.value || today(),
    situation,relatedTarget:document.getElementById("workClaimTarget")?.value.trim() || "",
    evidenceText:document.getElementById("workClaimEvidence")?.value.trim() || "",
    status:"pending",approvedWage:0,paid:false,createdAt:at,updatedAt:at
  });
  toast("업무 기록을 제출했습니다.");
}
window.reviewWorkClaim = async function(id,status){
  if(!studentHasRole(selectedStudent,"tax_office")) return toast("국세청 권한이 없습니다.");
  const c=obj(data.workClaims)[id];
  if(!c || c.status!=="pending") return toast("심사 대기 기록을 찾을 수 없습니다.");
  if(c.studentId===selectedStudent) return toast("본인 업무 기록은 심사할 수 없습니다.");
  const reason=prompt(status==="approved"?"승인 메모(선택)":"사유를 입력하세요","");
  if((status==="rejected" || status==="held") && !String(reason||"").trim()) return toast("거부/보류 사유는 필수입니다.");
  const updates={status,reviewedBy:selectedStudent,reviewedByName:studentName(selectedStudent),reviewedAt:new Date().toISOString(),reviewReason:String(reason||"").trim(),updatedAt:new Date().toISOString()};
  if(status==="approved"){
    const rule=workRuleByClaim(c);
    const wage=money(rule?.wage ?? job(c.jobId)?.wage ?? 0);
    if(wage<=0) return toast("임금표에서 임금액을 찾을 수 없습니다.");
    updates.approvedWage=wage;
    updates.paid=false;
  }
  await dbUpdate("workClaims/"+id,updates);
  toast(`${claimStatusText(status)} 처리했습니다.`);
}
async function payApprovedWorkClaimIds(ids,paidBy="teacher"){
  ids=[...new Set(ids.filter(Boolean))];
  if(!ids.length) return toast("지급할 업무임금이 없습니다.");
  let paid=0,total=0;
  const result=await runTransaction(rootRef,current=>{
    if(!current) return current;
    current.ledger=current.ledger||{};
    current.workClaims=current.workClaims||{};
    ids.forEach(id=>{
      const c=current.workClaims[id];
      if(!c || c.status!=="approved" || c.paid===true || money(c.approvedWage)<=0) return;
      const amount=money(c.approvedWage);
      const ledgerId="tx_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6)+"_"+paid;
      current.ledger[ledgerId]={id:ledgerId,ts:seoulIsoString(),day:today(),type:"wage",desc:"업무 임금 지급",lines:[{account:CENTRAL,delta:-amount},{account:c.studentId,delta:amount}],meta:{reason:"업무 임금 지급",source:"workClaim",workClaimId:id,studentId:c.studentId,amount,type:"wage",createdAt:seoulIsoString()}};
      c.status="paid"; c.paid=true; c.paidAt=new Date().toISOString(); c.paidBy=paidBy; c.updatedAt=new Date().toISOString();
      paid++; total+=amount;
    });
    return current;
  });
  if(!result.committed) return toast("지급 처리에 실패했습니다.");
  toast(`${paid}건 ${won(total)} 지급 완료`);
}
window.paySingleWorkClaim = id=>payApprovedWorkClaimIds([id]);
window.payApprovedWorkClaimsForStudent = studentId=>payApprovedWorkClaimIds(approvedUnpaidClaims().filter(c=>c.studentId===studentId).map(c=>c.id));
window.payAllApprovedWorkClaims = ()=>payApprovedWorkClaimIds(approvedUnpaidClaims().map(c=>c.id));
window.payTaxOfficeWage = async function(officerId){
  if(!studentHasRole(officerId,"tax_office")) return toast("국세청 학생이 아닙니다.");
  const est=taxOfficeWageEstimate(officerId);
  const recordId=taxOfficeWageRecordId(officerId,est.day);
  if(obj(data.taxOfficeWageRecords)[recordId]) return toast("이미 지급된 국세청 임금입니다.");
  if(est.total<=0) return toast("지급할 국세청 임금이 없습니다.");
  const result=await runTransaction(rootRef,current=>{
    if(!current) return current;
    current.taxOfficeWageRecords=current.taxOfficeWageRecords||{};
    if(current.taxOfficeWageRecords[recordId]) return current;
    current.ledger=current.ledger||{};
    const ledgerId="tx_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
    current.ledger[ledgerId]={id:ledgerId,ts:seoulIsoString(),day:today(),type:"wage",desc:"국세청 자동 임금 지급",lines:[{account:CENTRAL,delta:-est.total},{account:officerId,delta:est.total}],meta:{source:"taxOfficeWage",recordId,officerId,...est}};
    current.taxOfficeWageRecords[recordId]={id:recordId,officerId,officerName:studentName(officerId),amount:est.total,day:est.day,paidAt:new Date().toISOString(),paidBy:"teacher",details:est,ledgerId};
    return current;
  });
  toast(result.committed ? "국세청 임금을 지급했습니다." : "지급 처리에 실패했습니다.");
}
window.buyRetailerSnack = async function(pid){
  const buyer=selectedStudent;
  if(!studentHasRole(buyer,"snack_retailer")) return toast("과자 소매상만 구매할 수 있습니다.");
  const p=product(pid); if(!p) return toast("상품을 찾을 수 없습니다.");
  const qty=money(document.getElementById(`snackQty_${pid}`)?.value);
  if(qty<=0) return toast("수량을 확인하세요.");
  const unitPrice=productWholesalePrice(p);
  const total=unitPrice*qty;
  const stock=p.stock ?? p.wholesaleStock ?? p.inventory;
  if(stock!==undefined && n(stock)<qty) return toast("재고가 부족합니다.");
  if(!requireCash(buyer,total)) return;
  const inv=n(obj(obj(data.inventories)[buyer])[pid]);
  const updates={[`inventories/${buyer}/${pid}`]:inv+qty};
  if(p.stock!==undefined) updates[`products/${pid}/stock`]=n(p.stock)-qty;
  else if(p.wholesaleStock!==undefined) updates[`products/${pid}/wholesaleStock`]=n(p.wholesaleStock)-qty;
  else if(p.inventory!==undefined) updates[`products/${pid}/inventory`]=n(p.inventory)-qty;
  await dbUpdate("",updates);
  await addLedger("snackRetailerPurchase",`${studentName(buyer)} 과자 소매상 구매: ${p.name} ${qty}개`,[{account:buyer,delta:-total},{account:CENTRAL,delta:total}],{buyerStudentId:buyer,buyerName:studentName(buyer),itemId:pid,itemName:p.name,quantity:qty,unitPrice,totalPrice:total,type:"snackRetailerPurchase",createdAt:new Date().toISOString()});
  toast("과자 구매 완료");
}
window.addJob = async function(){
  const name=document.getElementById("newJobName")?.value.trim();
  if(!name) return toast("직업명을 입력하세요.");
  const id="job_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,5);
  const item={id,name,wage:money(document.getElementById("newJobWage")?.value),payType:document.getElementById("newJobPayType")?.value||"일당",slots:n(document.getElementById("newJobSlots")?.value)||1,note:document.getElementById("newJobNote")?.value.trim()||""};
  await dbSet("jobs/"+id,item);
  toast("직업 추가 완료");
}
window.editJob = async function(id){
  const j=job(id); if(!j) return;
  const name=prompt("직업명",j.name); if(!name) return;
  const wage=prompt("임금",j.wage);
  const payType=prompt("지급방식(일당/건당/변동 일당/자율)",j.payType||"일당")||"일당";
  const slots=prompt("정원",j.slots||1);
  const note=prompt("비고",j.note||"")||"";
  await dbUpdate("jobs/"+id,{name:name.trim(),wage:money(wage),payType:payType.trim(),slots:n(slots)||1,note:note.trim()});
  toast("직업 수정 완료");
}
window.deleteJob = async function(id){
  const j=job(id); if(!j) return;
  if(!confirm(`${j.name} 직업을 삭제할까요? 학생 배정도 함께 해제됩니다.`)) return;
  const updates={["jobs/"+id]:null};
  students().forEach(s=>{
    if(studentHasJob(s,id)){
      updates[`students/${s.id}/jobIds/${id}`]=null;
      if(s.jobId===id) updates[`students/${s.id}/jobId`]=null;
      if((s.job||"")===j.name) updates[`students/${s.id}/job`]="";
    }
  });
  await dbUpdate("",updates);
  toast("직업 삭제 완료");
}
async function assignJob(studentId,jobId){
  const s=student(studentId); if(!s) return false;
  const j=jobId ? job(jobId) : null;
  if(jobId && !j) return toast("직업을 찾을 수 없습니다."), false;
  if(studentHasJob(s,jobId)) return toast("이미 보유한 직업입니다."), false;
  if(j){
    const assigned=assignedStudentsForJob(jobId).filter(x=>x.id!==studentId).length;
    if(n(j.slots)>0 && assigned>=n(j.slots)){
      if(!confirm(`${j.name} 정원이 가득 찼습니다. 그래도 배정할까요?`)) return false;
    }
  }
  const nextNames=jobNamesFromIds([...studentJobIds(s),jobId].filter((id,i,a)=>a.indexOf(id)===i));
  await dbUpdate("students/"+studentId,{[`jobIds/${jobId}`]:true,job:nextNames});
  return true;
}
async function removeJob(studentId,jobId){
  const s=student(studentId); if(!s||!jobId) return false;
  const remaining=studentJobIds(s).filter(id=>id!==jobId);
  const updates={[`jobIds/${jobId}`]:null,job:jobNamesFromIds(remaining)};
  if(s.jobId===jobId) updates.jobId=null;
  await dbUpdate("students/"+studentId,updates);
  return true;
}
window.assignSelectedJob = async function(){
  const studentId=document.getElementById("assignStudent")?.value;
  const jobId=document.getElementById("assignJob")?.value;
  if(!studentId) return toast("학생을 선택하세요.");
  if(!jobId) return toast("직업을 선택하세요.");
  if(await assignJob(studentId,jobId)) toast("직업 추가 완료");
}
window.assignJobToStudent = async function(studentId){
  const jobId=document.getElementById("assignJob_"+studentId)?.value || "";
  if(!jobId) return toast("추가할 직업을 선택하세요.");
  if(await assignJob(studentId,jobId)) toast("직업 추가 완료");
}
window.removeJobFromStudent = async function(studentId){
  const jobId=document.getElementById("removeJob_"+studentId)?.value || "";
  if(!jobId) return toast("제거할 직업이 없습니다.");
  if(await removeJob(studentId,jobId)) toast("직업 제거 완료");
}
window.clearJobsFromStudent = async function(studentId){
  const s=student(studentId); if(!s) return;
  if(!confirm(`${s.name} 학생의 직업을 전부 해제할까요?`)) return;
  const updates={jobId:null,jobIds:null,job:""};
  await dbUpdate("students/"+studentId,updates);
  toast("직업 전체 해제 완료");
}
function selectedExcludedStudents(){
  return Array.from(document.querySelectorAll(".salaryExclude:checked")).map(x=>x.value);
}
function wageForStudentByJobs(s){
  const base=studentJobIds(s).reduce((sum,id)=>sum+money(job(id)?.wage||0),0);
  return money(base*dutyWageMultiplier(s.id));
}

function fineNoticeExists(studentId,relatedWarningIds=[]){
  const key=[...relatedWarningIds].sort().join("|");
  return arr(data.fines).some(f=>{
    if(f.studentId!==studentId || f.status==="cancelled") return false;
    const other=arr(f.relatedWarningIds).sort().join("|");
    return key && key===other;
  });
}
async function createFineNotice(studentId,{reason="벌금",warningCountAtIssue=0,createdBy="teacher",relatedWarningIds=[],source="",actorId=""}={}){
  if(!student(studentId)) return null;
  if(relatedWarningIds.length && fineNoticeExists(studentId,relatedWarningIds)) return null;
  const calc=calculateFineAmount(studentId);
  const issuedAt=new Date().toISOString();
  const id="fine_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  const fine={
    id,
    studentId,
    reason,
    warningCountAtIssue,
    issuedAt,
    dueDate:fineDueDate(issuedAt),
    assetSnapshot:calc.assetSnapshot,
    fineRate:calc.fineRate,
    fineAmount:calc.fineAmount,
    minFine:calc.minFine,
    maxFine:calc.maxFine,
    status:"unpaid",
    paidAt:"",
    paidAmount:0,
    remainingAmount:calc.fineAmount,
    paymentSource:"",
    createdBy,
    source,
    actorId,
    relatedWarningIds
  };
  await dbSet("fines/"+id,fine);
  return fine;
}
async function cancelUnpaidFinesForWarning(warningId){
  const updates={};
  arr(data.fines).forEach(f=>{
    if(arr(f.relatedWarningIds).includes(warningId) && fineEffectiveStatus(f)!=="paid" && n(f.paidAmount)<=0){
      updates[`fines/${f.id}/status`]="cancelled";
      updates[`fines/${f.id}/cancelledAt`]=new Date().toISOString();
      updates[`fines/${f.id}/cancelReason`]="warning_cancelled";
    }
  });
  if(Object.keys(updates).length) await dbUpdate("",updates);
}
async function applyWarningFineIfNeeded(targetId,source,warningId,explicitCount=null){
  const existing=roleWarnings().filter(w=>w.targetId===targetId && w.source===source && w.status!=="cancelled" && w.id!==warningId);
  const count=explicitCount===null ? existing.length+1 : explicitCount;
  if(count>0 && count%2===0){
    const relatedWarningIds=[warningId,...existing.map(w=>w.id)].filter(Boolean).slice(0,2);
    const fine=await createFineNotice(targetId,{
      reason:`${specialRoleName(source)} 경고 ${count}회`,
      warningCountAtIssue:count,
      createdBy:"system",
      relatedWarningIds:[...new Set(relatedWarningIds)].slice(0,2),
      source
    });
    return fine ? n(fine.fineAmount) : 0;
  }
  return 0;
}
async function createRoleWarning(source,actorId,targetId,reason,appealable=false){
  if(!targetId) return toast("대상 학생을 선택하세요"), false;
  if(actorId===targetId) return toast("자기 자신에게는 경고할 수 없습니다."), false;
  if(source==="police" && !String(reason||"").trim()) return toast("경찰 경고는 사유가 반드시 필요합니다."), false;
  const id="warn_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  const existingCount=activeWarningsForStudent(targetId,source).length;
  await dbSet("roleWarnings/"+id,{id,source,actorId,targetId,reason:String(reason||"").trim(),appealable,status:"issued",ts:new Date().toISOString()});
  const fine=await applyWarningFineIfNeeded(targetId,source,id,existingCount+1);
  toast(`${studentName(targetId)} 경고 완료${fine?` / 벌금 고지서 ${won(fine)} 생성`:""}`);
  return true;
}
window.setDutyNeglectByPolice = async function(){
  if(!studentHasRole(selectedStudent,"police")) return toast("경찰 권한이 없습니다.");
  const target=document.getElementById("policeDutyTarget")?.value;
  const stage=Math.max(0,Math.min(3,Math.floor(n(document.getElementById("policeDutyStage")?.value))));
  if(!target) return toast("대상을 선택하세요.");
  if(!confirm(`${studentName(target)}의 직무유기 단계를 ${stage}단계로 설정할까요?`)) return;
  await dbSet("dutyNeglect/"+target,stage);
  await addLedger("직무유기기록",`${studentName(selectedStudent)} 경찰이 ${studentName(target)} 직무유기 ${stage}단계 기록`,[],{police:selectedStudent,target,stage});
  toast("직무유기 단계를 저장했습니다.");
}
window.issuePoliceWarning = async function(){
  if(!studentHasRole(selectedStudent,"police")) return toast("경찰 권한이 없습니다.");
  await createRoleWarning("police",selectedStudent,document.getElementById("policeWarnTarget")?.value,document.getElementById("policeWarnReason")?.value,true);
}
window.issueRefereeWarning = async function(){
  if(!studentHasRole(selectedStudent,"referee")) return toast("심판 권한이 없습니다.");
  await createRoleWarning("referee",selectedStudent,document.getElementById("refereeWarnTarget")?.value,document.getElementById("refereeWarnReason")?.value,true);
}
window.appealRoleWarning = async function(id){
  const w=obj(data.roleWarnings)[id];
  if(!w || w.targetId!==selectedStudent || !w.appealable || w.status!=="issued") return toast("이의신청할 수 없는 경고입니다.");
  const reason=prompt("이의신청 내용을 적어주세요.","");
  if(reason===null) return;
  await dbUpdate("roleWarnings/"+id,{status:"appealed",appealReason:String(reason||""),appealedAt:new Date().toISOString()});
  toast("이의신청을 보냈습니다.");
}
window.appealRefereeWarning = window.appealRoleWarning;
window.resolveRoleWarningAppeal = async function(id,status){
  const w=obj(data.roleWarnings)[id]; if(!w) return;
  await dbUpdate("roleWarnings/"+id,{status,reviewedAt:new Date().toISOString()});
  if(status==="cancelled") await cancelUnpaidFinesForWarning(id);
  toast(status==="cancelled"?"이의신청을 인용했습니다.":"경고를 유지했습니다.");
}
window.resolveRefereeAppeal = window.resolveRoleWarningAppeal;
window.cancelMyRoleWarning = async function(id){
  const w=obj(data.roleWarnings)[id];
  if(!w) return toast("경고 기록을 찾을 수 없습니다.");
  if(w.actorId!==selectedStudent) return toast("내가 부여한 경고만 취소할 수 있습니다.");
  if(w.status==="cancelled") return toast("이미 취소된 경고입니다.");
  if(!confirm(`${studentName(w.targetId)}의 ${specialRoleName(w.source)} 경고를 취소할까요?`)) return;
  await dbUpdate("roleWarnings/"+id,{status:"cancelled",cancelledAt:new Date().toISOString(),cancelledBy:selectedStudent});
  await cancelUnpaidFinesForWarning(id);
  toast("경고를 취소했습니다.");
}
window.resetDutyStage = async function(){
  const id=document.getElementById("resetDutyStudent")?.value;
  if(!id) return toast("학생을 선택하세요.");
  await dbSet("dutyNeglect/"+id,0);
  toast("직무유기 단계를 초기화했습니다.");
}
window.taxOfficeCollect = async function(ledgerId){
  if(!studentHasRole(selectedStudent,"tax_office")) return toast("국세청 권한이 없습니다.");
  const e=obj(data.ledger)[ledgerId]; if(!e) return toast("거래를 찾을 수 없습니다.");
  const lines=taxableLedgerLines(e);
  if(!lines.length) return toast("징수할 미납 세금이 없습니다.");
  for(const l of lines){
    const charge=money(l.amount*1.5);
    if(!requireCash(l.account,charge)) return;
  }
  const ledgerLines=[];
  let centralTax=0, officerReward=0;
  lines.forEach(l=>{
    const baseTax=money(l.amount);
    const extra=money(l.amount*0.5);
    ledgerLines.push({account:l.account,delta:-(baseTax+extra)});
    centralTax+=baseTax;
    officerReward+=extra;
  });
  ledgerLines.push({account:CENTRAL,delta:centralTax});
  ledgerLines.push({account:selectedStudent,delta:officerReward});
  await addLedger("국세청징수",`${studentName(selectedStudent)} 국세청 미납세금 적발: ${e.desc}`,ledgerLines,{taxAudited:true,sourceLedger:ledgerId,officer:selectedStudent});
  await dbUpdate("ledger/"+ledgerId+"/meta",{...obj(e.meta),taxCharged:true,taxPaid:true,taxAudited:true,taxOfficer:selectedStudent,tax:centralTax,reward:officerReward});
  toast(`세금 ${won(centralTax)} 국고 귀속, 포상 ${won(officerReward)} 지급 완료`);
}

window.payBulkWages = async function(){
  const mode=document.getElementById("bulkWageMode")?.value || "job";
  const fixed=money(document.getElementById("bulkWageAmount")?.value);
  const desc=document.getElementById("bulkWageDesc")?.value || "일괄 임금 지급";
  const excluded=new Set(selectedExcludedStudents());
  const target=students().filter(s=>!excluded.has(s.id));
  if(!target.length) return toast("지급 대상 학생이 없습니다.");
  const lines=[];
  let total=0;
  const paidNames=[];
  const skipped=[];
  target.forEach(s=>{
    const amount = mode==="fixed" ? fixed : wageForStudentByJobs(s);
    if(amount>0){
      lines.push({account:s.id,delta:amount});
      total+=amount;
      paidNames.push(`${s.name} ${won(amount)}`);
    }else{
      skipped.push(s.name);
    }
  });
  if(total<=0) return toast("지급할 임금이 없습니다.");
  lines.unshift({account:CENTRAL,delta:-total});
  await addLedger(mode==="fixed"?"일괄지급":"직업임금",desc,lines,{excluded:[...excluded],paid:paidNames,skipped});
  if(mode==="job"){
    const resets={};
    target.forEach(s=>{resets["dutyNeglect/"+s.id]=0;});
    if(Object.keys(resets).length) await updateFields(resets);
  }
  toast(`${paidNames.length}명에게 ${won(total)} 지급 완료${mode==="job"?" / 직무유기 단계 초기화":""}${skipped.length?` / 제외·미지급 ${skipped.length}명`:""}`);
}

window.addStudent = async function(){
  const name=document.getElementById("addName").value.trim(); if(!name) return toast("이름을 입력하세요.");
  const id=sid(); const s={id,name,job:document.getElementById("addJob").value.trim(),jobIds:{},pin:document.getElementById("addPin").value.trim()||"1234"};
  await dbSet("students/"+id,s);
  const initial=n(document.getElementById("addInitial").value);
  if(initial>0) await addLedger("초기지급",`${name} 초기 지급`,[{account:CENTRAL,delta:-initial},{account:id,delta:initial}]);
  toast("학생 추가 완료");
}
window.bulkAddStudents = async function(){
  const names=document.getElementById("bulkNames").value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
  const initial=n(document.getElementById("bulkInitial").value);
  for(const name of names){
    const id=sid(); await dbSet("students/"+id,{id,name,job:"",jobIds:{},pin:"1234"});
    if(initial>0) await addLedger("초기지급",`${name} 초기 지급`,[{account:CENTRAL,delta:-initial},{account:id,delta:initial}]);
  }
  toast(`${names.length}명 추가 완료`);
}
window.editStudent = async function(id){
  const s=student(id); if(!s) return;
  const name=prompt("이름",s.name); if(!name) return;
  const job=prompt("직업",s.job||"")||"";
  const pin=prompt("PIN",s.pin||"1234")||"1234";
  await dbUpdate("students/"+id,{name:name.trim(),job:job.trim(),pin:pin.trim()});
}
window.deleteStudent = async function(id){ if(confirm("학생을 삭제할까요? 거래장부는 남습니다.")) await dbRemove("students/"+id); }

window.payStudent = async function(){
  const id=document.getElementById("payStudent").value, amount=n(document.getElementById("payAmount").value), desc=document.getElementById("payDesc").value||"지급";
  if(!id||amount<=0) return toast("학생과 금액을 확인하세요.");
  await addLedger("지급",desc,[{account:CENTRAL,delta:-amount},{account:id,delta:amount}]); toast("지급 완료");
}
window.payAll = async function(){
  const amount=n(document.getElementById("salaryAmount").value), desc=document.getElementById("salaryDesc").value||"전체 지급";
  if(amount<=0) return; const st=students(); if(!st.length) return toast("학생 없음");
  await addLedger("전체지급",desc,[{account:CENTRAL,delta:-amount*st.length},...st.map(s=>({account:s.id,delta:amount}))]); toast("전체 지급 완료");
}
function selectedBulkTxStudents(){
  return Array.from(document.querySelectorAll(".bulkTxStudent:checked")).map(el=>el.value).filter(Boolean);
}
window.refreshBulkTxSelection = function(){
  const count=selectedBulkTxStudents().length;
  const el=document.getElementById("bulkTxCount");
  if(el) el.textContent=`${count}명 선택`;
}
window.setBulkTxMode = function(mode){
  document.getElementById("bulkTxMode").value=mode;
  document.querySelectorAll(".txModeBtns button").forEach(btn=>btn.classList.remove("active"));
  document.getElementById(`bulkMode_${mode}`)?.classList.add("active");
  const desc=document.getElementById("bulkTxDesc");
  if(desc && (!desc.value || ["수업 보상","기타 회수","벌금"].includes(desc.value))){
    desc.value=mode==="pay"?"수업 보상":mode==="collect"?"기타 회수":"벌금";
  }
}
window.toggleBulkTxStudents = function(checked){
  document.querySelectorAll(".bulkTxStudent").forEach(el=>el.checked=checked);
  window.refreshBulkTxSelection();
}
window.runBulkStudentTransaction = async function(){
  const mode=document.getElementById("bulkTxMode")?.value || "pay";
  const ids=selectedBulkTxStudents();
  if(!ids.length) return toast("학생을 선택하세요.");
  const amount=money(document.getElementById("bulkTxAmount")?.value);
  const desc=document.getElementById("bulkTxDesc")?.value || (mode==="pay"?"지급":mode==="collect"?"회수":"벌금");
  if(mode!=="fine" && amount<=0) return toast("금액을 확인하세요.");
  if(mode==="fine"){
    const created=[];
    for(const id of ids){
      const fine=await createFineNotice(id,{reason:desc||"수동 벌금",createdBy:"teacher"});
      if(fine) created.push(`${studentName(id)} ${won(fine.fineAmount)}`);
    }
    toast(created.length ? `벌금 고지서 ${created.length}건 생성 완료` : "생성된 벌금 고지서가 없습니다.");
    return;
  }
  const lines=[];
  let total=0;
  const details=[];
  for(const id of ids){
    const each=mode==="fine" ? fineAmount(id) : amount;
    if(each<=0) continue;
    if(mode!=="pay" && !requireCash(id,each)) return;
    if(mode==="pay") lines.push({account:id,delta:each});
    else lines.push({account:id,delta:-each});
    total+=each;
    details.push(`${studentName(id)} ${won(each)}`);
  }
  if(total<=0) return toast("처리할 금액이 없습니다.");
  if(mode==="pay") lines.unshift({account:CENTRAL,delta:-total});
  else lines.push({account:CENTRAL,delta:total});
  const type=mode==="pay"?"상금지급":mode==="collect"?"일괄회수":"벌금";
  if(!confirm(`${ids.length}명 ${mode==="pay"?"지급":mode==="collect"?"환수":"벌금"} 처리\n총액: ${won(total)}\n\n${details.join(" / ")}`)) return;
  await addLedger(type,desc,lines,{mode,targets:ids,details});
  toast(`${ids.length}명 처리 완료: ${won(total)}`);
}
async function doTransfer(from,to,amount,desc="송금"){
  amount=money(amount); if(!from||!to||from===to||amount<=0) return false;
  if(hasUnpaidFine(from)){toast("미납 벌금이 있어 개인 간 송금이 제한됩니다. 벌금부터 납부하세요."); return false;}
  if(!requireCash(from,amount)) return false;
  await addLedger("송금",desc,[{account:from,delta:-amount},{account:to,delta:amount}],{tax:0}); return true;
}
window.manualTransfer = async function(){ if(await doTransfer(document.getElementById("fromStudent").value,document.getElementById("toStudent").value,n(document.getElementById("transferAmount").value),"학생 간 송금")) toast("송금 완료"); }
window.setLedgerTaxPaid = async function(id,paid){
  const e=obj(data.ledger)[id]; if(!e) return toast("거래내역을 찾을 수 없습니다.");
  if(!isStudentTradeLedger(e)) return toast("학생 간 거래만 거래왕 집계에 반영됩니다.");
  await dbSet(`ledger/${id}/meta/taxPaid`,!!paid);
  toast(paid?"거래왕 집계에 포함했습니다.":"거래왕 집계에서 제외했습니다.");
}
window.payMyLedgerTax = async function(id){
  const e=obj(data.ledger)[id]; if(!e) return toast("거래내역을 찾을 수 없습니다.");
  if(!selectedStudent || !ledgerStudentParticipants(e).includes(selectedStudent)) return toast("내가 참여한 거래만 납부할 수 있습니다.");
  if(!isStudentTradeLedger(e)) return toast("학생 간 거래만 세금을 납부할 수 있습니다.");
  if(ledgerTaxPaid(e)) return toast("이미 세금 납부 처리된 거래입니다.");
  const amount=studentTaxDueForLedger(e,selectedStudent);
  if(amount<=0) return toast("내가 납부할 세금이 없습니다.");
  if(!requireCash(selectedStudent,amount)) return;
  await addLedger("거래세",`${e.desc||e.type} 세금`,[{account:selectedStudent,delta:-amount},{account:CENTRAL,delta:amount}],{sourceLedgerId:id,payer:selectedStudent});
  await dbUpdate("",{
    [`ledger/${id}/meta/taxPaid`]:true,
    [`ledger/${id}/meta/taxCharged`]:true,
    [`ledger/${id}/meta/taxPaidBy/${selectedStudent}`]:true
  });
  toast("세금 납부 완료");
}
window.chargeFine = async function(){
  const id=document.getElementById("fineStudent").value; if(!id) return toast("학생 선택");
  const fine=await createFineNotice(id,{reason:document.getElementById("fineDesc")?.value||"수동 벌금",createdBy:"teacher"});
  toast(fine ? `벌금 고지서 생성 완료: ${won(fine.fineAmount)}` : "벌금 고지서를 만들 수 없습니다.");
}
window.payFineNotice = async function(fineId){
  const f=obj(data.fines)[fineId];
  if(!f || !f.studentId) return toast("벌금 고지서를 찾을 수 없습니다.");
  if(selectedStudent && mode==="student" && f.studentId!==selectedStudent) return toast("내 벌금만 납부할 수 있습니다.");
  const remain=remainingFineAmount(f);
  if(remain<=0) return toast("이미 납부 완료된 벌금입니다.");
  const cash=money(balanceOf(f.studentId));
  if(cash<=0) return toast("잔고가 부족합니다. 부분 납부도 할 수 없습니다.");
  const pay=Math.min(cash,remain);
  const paidAmount=money(n(f.paidAmount)+pay);
  const remainingAmount=money(Math.max(0,n(f.fineAmount)-paidAmount));
  const status=remainingAmount<=0 ? "paid" : "partial";
  const updates={
    [`fines/${fineId}/paidAmount`]:paidAmount,
    [`fines/${fineId}/remainingAmount`]:remainingAmount,
    [`fines/${fineId}/status`]:status,
    [`fines/${fineId}/paymentSource`]:"personalCash"
  };
  if(status==="paid") updates[`fines/${fineId}/paidAt`]=new Date().toISOString();
  await dbUpdate("",updates);
  await addLedger("벌금납부",`${studentName(f.studentId)} ${f.reason||"벌금"} 납부`,[{account:f.studentId,delta:-pay},{account:CENTRAL,delta:pay}],{fineId,pay,remainingAmount});
  toast(status==="paid" ? "벌금 전액 납부 완료" : `부분 납부 완료, 남은 금액 ${won(remainingAmount)}`);
}
window.collectMoney = async function(){
  const id=document.getElementById("collectStudent").value, amount=n(document.getElementById("collectAmount").value); if(!id||amount<=0||!requireCash(id,amount)) return;
  await addLedger("회수",document.getElementById("collectDesc").value||"회수",[{account:id,delta:-amount},{account:CENTRAL,delta:amount}]); toast("회수 완료");
}
window.chargeLedgerTax = async function(id){
  const e=obj(data.ledger)[id]; if(!e) return toast("거래내역을 찾을 수 없습니다.");
  const lines=taxableLedgerLines(e);
  if(!lines.length) return toast("부과할 세금이 없거나 이미 세금 처리된 거래입니다.");
  const total=lines.reduce((a,l)=>a+l.amount,0);
  const summary=lines.map(l=>`${studentName(l.account)} ${won(l.amount)}`).join(" / ");
  if(!confirm(`이 거래내역에 세금 ${won(total)}을 부과할까요?\n\n${summary}`)) return;
  for(const l of lines){ if(!requireCash(l.account,l.amount)) return; }
  await addLedger("거래세",`${e.desc||e.type} 세금`,[...lines.map(l=>({account:l.account,delta:-l.amount})),{account:CENTRAL,delta:total}],{sourceLedgerId:id});
  await dbUpdate(`ledger/${id}/meta`,{taxCharged:true,taxPaid:true});
  toast("세금 부과 완료");
}

window.doWholesale = async function(){
  const buyer=document.getElementById("wholesaleBuyer").value, pid=document.getElementById("wholesaleProduct").value, qty=money(document.getElementById("wholesaleQty").value);
  if(!buyer||qty<=0) return; const p=product(pid); const unitPrice=productWholesalePrice(p); const total=unitPrice*qty; if(!requireCash(buyer,total)) return;
  const current=n(obj(obj(data.inventories)[buyer])[pid]);
  await dbSet(`inventories/${buyer}/${pid}`, current+qty);
  await addLedger("도매구매",`${studentName(buyer)} ${p.name} 도매 ${qty}개`,[{account:buyer,delta:-total},{account:CENTRAL,delta:total}],{productId:pid,qty,unitPrice,totalPrice:total,type:"snackWholesalePurchase"});
  toast("도매 구매 완료");
}
async function doRetailPurchase(buyer,seller,pid,qty,unitPrice){
  qty=money(qty); unitPrice=productPrice(product(pid)); if(!buyer||!seller||buyer===seller||qty<=0||unitPrice<=0) return false;
  const sellerInv=n(obj(obj(data.inventories)[seller])[pid]); if(sellerInv<qty){toast("소매상 재고 부족"); return false;}
  const subtotal=qty*unitPrice, tx=tax(subtotal), total=subtotal+tx; if(!requireCash(buyer,total)) return false;
  await dbSet(`inventories/${seller}/${pid}`, sellerInv-qty);
  await addLedger("소매구매",`${studentName(buyer)} → ${studentName(seller)} ${product(pid)?.name} ${qty}개`,[{account:buyer,delta:-total},{account:seller,delta:subtotal},{account:CENTRAL,delta:tx}],{productId:pid,qty,unitPrice,totalPrice:subtotal,tax:tx,type:"snackRetailPurchase"});
  return true;
}
window.manualRetailPurchase = async function(){ if(await doRetailPurchase(document.getElementById("retailBuyer").value,document.getElementById("retailSeller").value,document.getElementById("retailProduct").value,n(document.getElementById("retailQty").value),n(document.getElementById("retailUnit").value))) toast("구매 완료"); }

window.saveSnackProductPrices = async function(){
  const updates={};
  arr(data.products).forEach(raw=>{
    const id=raw.id;
    if(!id) return;
    updates[`products/${id}/priceType`]=document.getElementById(`snack_${id}_priceType`)?.value || "economyIndex";
    updates[`products/${id}/fixedPrice`]=money(document.getElementById(`snack_${id}_fixedPrice`)?.value);
    updates[`products/${id}/basePrice`]=money(document.getElementById(`snack_${id}_basePrice`)?.value);
    updates[`products/${id}/baseEconomyIndex`]=money(document.getElementById(`snack_${id}_baseEconomyIndex`)?.value)||100;
    updates[`products/${id}/sensitivity`]=n(document.getElementById(`snack_${id}_sensitivity`)?.value)||1;
    updates[`products/${id}/minPrice`]=money(document.getElementById(`snack_${id}_minPrice`)?.value)||1;
    const max=document.getElementById(`snack_${id}_maxPrice`)?.value;
    updates[`products/${id}/maxPrice`]=max==="" ? null : money(max);
    updates[`products/${id}/wholesaleRate`]=n(document.getElementById(`snack_${id}_wholesaleRate`)?.value)||0.65;
  });
  await dbUpdate("",updates);
  toast("과자 가격 설정 저장 완료");
}

window.updateTicket = async function(k,field,value){
  const t=ticketData(k); value=n(value);
  let supply=n(t.supply), sold=n(t.sold);
  if(field==="supply"){
    supply=Math.max(1,value);
    sold=clampNum(sold,0,supply);
  }
  if(field==="sold"){
    sold=clampNum(value,0,supply);
  }
  if(field==="stock"){
    sold=clampNum(supply-value,0,supply);
  }
  const next=normalizeTicketState({supply,sold,date:isTopDisplayTicket(k)?today():ticketStoredDate(t)});
  await dbUpdate(`tickets/${k}`,next);
}
async function doTicketBuy(studentId,k){
  if(!studentId||!ticketMeta[k]){toast("학생과 티켓을 확인하세요."); return false;}
  if(hasUnpaidFine(studentId)){toast("미납 벌금이 있어 티켓 구매가 제한됩니다. 벌금부터 납부하세요."); return false;}
  const t=ticketData(k); if(n(t.stock)<=0){toast("티켓 재고가 없어 구매할 수 없습니다."); return false;}
  const price=ticketBuy(k); if(!requireCash(studentId,price)) return false;
  const holding=n(obj(obj(data.ticketHoldings)[studentId])[k]);
  const next=normalizeTicketState({supply:n(t.supply),sold:n(t.sold)+1,date:isTopDisplayTicket(k)?today():ticketStoredDate(t)});
  const updates={};
  updates[`ticketHoldings/${studentId}/${k}`]=holding+1;
  updates[`tickets/${k}`]=next;
  await dbUpdate("",updates);
  await addLedger("티켓구매",`${studentName(studentId)} ${ticketMeta[k]?.name||k} 구매`,[{account:studentId,delta:-price},{account:CENTRAL,delta:price}],{ticketId:k,price});
  return true;
}
async function doTicketSell(studentId,k){
  if(!studentId||!ticketMeta[k]){toast("학생과 티켓을 확인하세요."); return false;}
  const holding=n(obj(obj(data.ticketHoldings)[studentId])[k]); if(holding<=0){toast("보유 티켓 없음"); return false;}
  const price=ticketSell(k), t=ticketData(k);
  const next=normalizeTicketState({supply:n(t.supply),sold:n(t.sold)-1,date:isTopDisplayTicket(k)?today():ticketStoredDate(t)});
  const updates={};
  updates[`ticketHoldings/${studentId}/${k}`]=holding-1;
  updates[`tickets/${k}`]=next;
  await dbUpdate("",updates);
  await addLedger("티켓판매",`${studentName(studentId)} ${ticketMeta[k]?.name||k} 판매`,[{account:CENTRAL,delta:-price},{account:studentId,delta:price}],{ticketId:k,price});
  return true;
}
async function doTicketUse(studentId,k){
  if(!studentId||!ticketMeta[k]){toast("학생과 티켓을 확인하세요."); return false;}
  const holding=n(obj(obj(data.ticketHoldings)[studentId])[k]); if(holding<=0){toast("보유 티켓 없음"); return false;}
  const t=ticketData(k);
  const next=normalizeTicketState({supply:n(t.supply),sold:n(t.sold)-1,date:isTopDisplayTicket(k)?today():ticketStoredDate(t)});
  const updates={};
  updates[`ticketHoldings/${studentId}/${k}`]=holding-1;
  updates[`tickets/${k}`]=next;
  await dbUpdate("",updates);
  await addLedger("티켓사용",`${studentName(studentId)} ${ticketMeta[k]?.name||k} 사용`,[],{ticketId:k,refund:0});
  return true;
}
window.manualTicketBuy = async function(){ if(await doTicketBuy(document.getElementById("ticketBuyer").value,document.getElementById("ticketBuyKind").value)) toast("티켓 구매 완료"); }
window.manualTicketSell = async function(){ if(await doTicketSell(document.getElementById("ticketSeller").value,document.getElementById("ticketSellKind").value)) toast("티켓 판매 완료"); }
window.manualTicketUse = async function(){ if(await doTicketUse(document.getElementById("ticketSeller").value,document.getElementById("ticketSellKind").value)) toast("티켓 사용 완료"); }

async function doDepositIn(id,amount){
  amount=money(amount); if(!id||amount<=0||!requireCash(id,amount)) return false;
  await dbSet(`deposits/${id}`,n(obj(data.deposits)[id])+amount);
  await addLedger("예금입금",`${studentName(id)} 예금 입금`,[{account:id,delta:-amount}],{depositDelta:amount});
  return true;
}
async function doDepositOut(id,amount){
  amount=money(amount); if(!id||amount<=0) return false;
  const dep=n(obj(data.deposits)[id]); if(dep<amount){toast("예금 부족"); return false;}
  await dbSet(`deposits/${id}`,dep-amount);
  await addLedger("예금출금",`${studentName(id)} 예금 출금`,[{account:id,delta:amount}],{depositDelta:-amount});
  return true;
}
window.depositMoney = async function(){
  if(await doDepositIn(document.getElementById("depositStudent").value, document.getElementById("depositAmount").value)) toast("입금 완료");
}
window.withdrawMoney = async function(){
  if(await doDepositOut(document.getElementById("withdrawStudent").value, document.getElementById("withdrawAmount").value)) toast("출금 완료");
}
window.payDepositInterest = async function(){
  const rate=depositInterestRateFromInput();
  const periods=depositInterestPeriodsFromInput();
  const rows=depositInterestRows(rate,periods);
  const total=money(rows.reduce((sum,row)=>sum+row.interest,0));
  if(total<=0) return toast("지급할 이자 없음");
  const updates={"settings/depositRate":rate,"settings/lastDepositInterestAt":new Date().toISOString()};
  rows.forEach(row=>{
    updates[`deposits/${row.student.id}`]=row.nextBalance;
  });
  await dbUpdate("",updates);
  await addLedger("예금이자",`예금 이자 ${Math.round(rate*1000)/10}%${periods>1?` x ${periods}회`:""}`,[{account:CENTRAL,delta:-total}],{
    rate,
    periods,
    total,
    deposits:rows.reduce((out,row)=>{
      out[row.student.id]={principal:row.principal,interest:row.interest,balance:row.nextBalance};
      return out;
    },{})
  });
  toast(`이자 지급 완료: ${won(total)}`);
}
window.payDepositInterestForStudent = async function(studentId){
  const s=student(studentId);
  if(!s) return toast("학생을 찾을 수 없습니다.");
  const rate=depositInterestRateFromInput();
  const periods=depositInterestPeriodsFromInput();
  const principal=money(n(obj(data.deposits)[studentId]));
  const interest=money(principal*(Math.pow(1+rate,periods)-1));
  if(principal<=0 || interest<=0) return toast("지급할 예금 이자가 없습니다.");
  const balance=money(principal+interest);
  await dbUpdate("",{
    [`deposits/${studentId}`]:balance,
    "settings/depositRate":rate,
    "settings/lastDepositInterestAt":new Date().toISOString()
  });
  await addLedger("예금이자",`${studentName(studentId)} 예금 이자 ${Math.round(rate*1000)/10}%${periods>1?` x ${periods}회`:""}`,[{account:CENTRAL,delta:-interest}],{
    rate,
    periods,
    total:interest,
    deposits:{[studentId]:{principal,interest,balance}}
  });
  toast(`${studentName(studentId)} 예금 이자 지급 완료: ${won(interest)}`);
}
window.paySavingInterest = async function(id){
  const s=obj(data.savings)[id];
  if(!s || s.status!=="active") return toast("진행 중인 적금을 찾을 수 없습니다.");
  const projected=savingProjection(s);
  const defaultPeriods=Math.max(1,projected.weeks||1);
  const input=prompt(`${studentName(s.owner)} 적금 이자를 몇 회분 지급할까요?`, String(defaultPeriods));
  if(input===null) return;
  const periods=Math.max(1,Math.floor(n(input)||defaultPeriods));
  const rate=(n(s.rate)||Math.round(savingsRate()*100))/100;
  const principal=money(s.balance ?? s.totalPaid ?? 0);
  const interest=money(principal*(Math.pow(1+rate,periods)-1));
  if(principal<=0 || interest<=0) return toast("지급할 적금 이자가 없습니다.");
  const balance=money(principal+interest);
  await dbUpdate("savings/"+id,{balance,lastInterestAt:today()});
  await addLedger("적금이자",`${studentName(s.owner)} 적금 이자 ${Math.round(rate*1000)/10}% x ${periods}회`,[{account:CENTRAL,delta:-interest}],{
    savingId:id,
    owner:s.owner,
    rate,
    periods,
    principal,
    interest,
    balance
  });
  toast(`적금 이자 지급 완료: ${won(interest)}`);
}
async function doBondBuy(studentId,principal,rate,issueId=""){
  let issue = issueId ? obj(data.bondIssues)[issueId] : null;
  if(issue){
    if((issue.status||"active")!=="active") return toast("판매 중인 채권이 아닙니다."), false;
    if(n(issue.remaining)<=0) return toast("채권 재고가 없습니다."), false;
    principal=money(issue.principal);
    rate=n(issue.rate);
  }else{
    principal=money(principal);
    rate=n(rate);
  }
  if(!studentId||principal<=0||!requireCash(studentId,principal)) return false;
  const start=new Date(), mature=new Date(start);
  mature.setDate(mature.getDate()+(issue?n(issue.days):n(data.settings.bondDays)));
  const id="bond_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  await dbSet("bonds/"+id,{id,owner:studentId,principal,rate,issueId:issue?.id||"",issueName:issue?bondIssueName(issue):"채권",start:start.toISOString().slice(0,10),mature:mature.toISOString().slice(0,10),status:"active"});
  if(issue) await dbUpdate("bondIssues/"+issue.id,{remaining:n(issue.remaining)-1});
  await addLedger("채권구매",`${studentName(studentId)} ${issue?bondIssueName(issue):"채권"} 구매`,[{account:studentId,delta:-principal},{account:CENTRAL,delta:principal}],{bondId:id,issueId:issue?.id||""});
  return true;
}
window.issueBond = async function(){
  const principal=money(document.getElementById("issueBondPrincipal")?.value);
  const rate=n(document.getElementById("issueBondRate")?.value);
  const days=Math.max(1,Math.floor(n(document.getElementById("issueBondDays")?.value)||n(data.settings.bondDays)||7));
  const total=Math.max(1,Math.floor(n(document.getElementById("issueBondTotal")?.value)||1));
  const name=(document.getElementById("issueBondName")?.value||`${days}일 국채`).trim();
  if(principal<=0) return toast("채권 1장 가격을 확인하세요.");
  const id="issue_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  await dbSet("bondIssues/"+id,{id,name,principal,rate,days,total,remaining:total,status:"active",createdAt:new Date().toISOString()});
  await dbUpdate("settings",{bondRate:rate/100,bondDays:days});
  toast("채권을 발행했습니다.");
}
window.toggleBondIssue = async function(id){
  const i=obj(data.bondIssues)[id]; if(!i) return;
  await dbSet(`bondIssues/${id}/status`,(i.status||"active")==="active"?"paused":"active");
  toast("채권 상태를 변경했습니다.");
}
window.deleteBondIssue = async function(id){
  const i=obj(data.bondIssues)[id]; if(!i) return;
  if(n(i.remaining)!==n(i.total) && !confirm("이미 일부 판매된 채권입니다. 발행 목록에서 삭제할까요? 보유 채권은 유지됩니다.")) return;
  await dbRemove("bondIssues/"+id);
  toast("발행 채권을 삭제했습니다.");
}
window.manualBondBuy = async function(){ const issueId=document.getElementById("manualBondIssue")?.value; const sid=document.getElementById("bondStudent")?.value; if(await doBondBuy(sid,0,0,issueId)) toast("채권 구매 완료"); }
window.matureBond = async function(id){
  const b=obj(data.bonds)[id]; if(!b||b.status!=="active") return;
  const pay=money(n(b.principal)*(1+n(b.rate)/100));
  await dbSet(`bonds/${id}/status`,"matured");
  await addLedger("채권만기",`${studentName(b.owner)} 채권 만기`,[{account:CENTRAL,delta:-pay},{account:b.owner,delta:pay}],{bondId:id,pay}); toast("만기 처리 완료");
}
window.matureDueBonds = async function(){ for(const b of arr(data.bonds).filter(b=>b.status==="active"&&new Date(b.mature+"T00:00:00")<=new Date())) await window.matureBond(b.id); }
window.earlyCancelBond = async function(id){
  const b=obj(data.bonds)[id]; if(!b||b.status!=="active") return;
  const pay=money(n(b.principal)*0.95); if(!confirm(`중도해지하면 ${won(pay)} 지급됩니다. 진행할까요?`)) return;
  await dbSet(`bonds/${id}/status`,"cancelled");
  await addLedger("채권중도해지",`${studentName(b.owner)} 채권 중도해지`,[{account:CENTRAL,delta:-pay},{account:b.owner,delta:pay}],{bondId:id,pay});
}


window.paySavingInstallment = async function(id){
  const s=obj(data.savings)[id]; if(!s||s.status!=="active") return;
  if(!canPaySaving(s)) return toast(`다음 납입일은 ${savingNextPayDate(s)}입니다.`);
  const installment=savingInstallment(s);
  if(!requireCash(s.owner,installment)) return;
  const projected=savingProjection(s);
  const newBalance=money(projected.balance+installment);
  const newTotal=money(n(s.totalPaid)+installment);
  await dbUpdate("savings/"+id,{
    balance:newBalance,
    totalPaid:newTotal,
    nextPayDate:addDays(today(),SAVING_PAYMENT_INTERVAL_DAYS),
    lastPaidDate:today(),
    lastInterestAt:projected.lastInterestAt
  });
  await addLedger("적금납입",`${studentName(s.owner)} 적금 납입`,[{account:s.owner,delta:-installment},{account:CENTRAL,delta:installment}],{savingId:id,installment,balance:newBalance});
  toast(`적금 ${won(installment)} 납입 완료`);
}
window.matureSaving = async function(id){
  const s=obj(data.savings)[id]; if(!s||s.status!=="active") return;
  const due=new Date((s.mature||"")+"T00:00:00")<=new Date();
  if(!due) return toast("아직 만기 전입니다.");
  const projected=savingProjection(s);
  const pay=money(projected.balance);
  await dbSet(`savings/${id}/status`,"matured");
  await dbUpdate("savings/"+id,{balance:pay,lastInterestAt:projected.lastInterestAt,maturedAt:new Date().toISOString()});
  if(pay>0) await addLedger("적금만기",`${studentName(s.owner)} 적금 만기 수령`,[{account:CENTRAL,delta:-pay},{account:s.owner,delta:pay}],{savingId:id,pay});
  toast(`적금 만기 수령 완료: ${won(pay)}`);
}
window.cancelSaving = async function(id){
  const s=obj(data.savings)[id]; if(!s||s.status!=="active") return;
  const projected=savingProjection(s);
  if(!confirm(`중도 해지하면 적금 평가액 ${won(projected.balance)}을 전혀 돌려받지 못합니다. 정말 해지할까요?`)) return;
  await dbUpdate("savings/"+id,{status:"cancelled",cancelledAt:new Date().toISOString(),forfeited:projected.balance,balance:projected.balance,lastInterestAt:projected.lastInterestAt});
  await addLedger("적금중도해지",`${studentName(s.owner)} 적금 중도해지: 환급 없음`,[],{savingId:id,forfeited:projected.balance});
  toast("적금을 중도 해지했습니다. 환급액은 0열매입니다.");
}
window.repayLoan = async function(id){
  const l=obj(data.loans)[id]; if(!l||l.status!=="active") return;
  const pay=money(n(l.amount)*(1+n(l.rate)/100));
  if(!requireCash(l.owner,pay)) return;
  if(!confirm(`대출 상환액 ${won(pay)}을 상환할까요?`)) return;
  await dbSet(`loans/${id}/status`,"repaid");
  await addLedger("대출상환",`${studentName(l.owner)} 대출 상환`,[{account:l.owner,delta:-pay},{account:CENTRAL,delta:pay}],{loanId:id,pay});
  toast("대출 상환 완료");
}
window.bankApproveLoan = async function(reqId){
  if(!studentHasRole(selectedStudent,"banker")) return toast("은행장 권한이 없습니다.");
  const r=obj(data.requests)[reqId]; if(!r||r.type!=="loanApply") return toast("대출 신청을 찾을 수 없습니다.");
  const rate=n(document.getElementById(`loanRate_${reqId}`)?.value)||suggestedLoanRate(r.studentId);
  if(!confirm(`${studentName(r.studentId)}에게 ${won(r.amount)} 대출을 금리 ${rate}%로 승인할까요?`)) return;
  if(await doLoanApprove(r,rate,selectedStudent)){
    await dbRemove("requests/"+reqId);
    toast("대출 승인 완료");
  }
}
window.bankRejectLoan = async function(reqId){
  if(!studentHasRole(selectedStudent,"banker")) return toast("은행장 권한이 없습니다.");
  const r=obj(data.requests)[reqId]; if(!r||r.type!=="loanApply") return toast("대출 신청을 찾을 수 없습니다.");
  if(!confirm(`${studentName(r.studentId)} 대출 신청을 거절할까요?`)) return;
  await dbRemove("requests/"+reqId);
  toast("대출 신청을 거절했습니다.");
}

window.fillProductUnitPrice = function(){
  const id=document.getElementById("reqProduct")?.value; const p=product(id); const el=document.getElementById("reqUnit");
  if(p && el) el.value = productPrice(p);
}
window.saveBondRate = async function(){
  const rate=n(document.getElementById("teacherBondRate").value)/100;
  await dbSet("settings/bondRate", rate);
  toast("채권 금리 저장 완료");
}
window.setStudentTab = function(tab){
  studentTab=tab;
  activeMobilePage="";
  localStorage.setItem("studentTab",tab);
  localStorage.removeItem("activeMobilePage");
  render();
}
window.setStudentNoticeTab = async function(tab){
  selectedNoticeStudentTab=tab;
  localStorage.setItem("studentNoticeTab",tab);
  if(tab==="message" && selectedStudent){
    const roomId=`room_${selectedStudent}`;
    await markRoomMessagesRead(roomId,"student").catch(()=>{});
    await dbUpdate(`teacherMessageRooms/${roomId}`,{unreadByStudent:0,updatedAt:seoulIsoString()}).catch(()=>{});
  }else{
    noticeState.messages=[];
  }
  render();
}
window.setTeacherNoticeTab = function(tab){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  selectedTeacherNoticeTab=tab;
  localStorage.setItem("teacherNoticeTab",tab);
  if(tab!=="messages"){
    selectedTeacherMessageRoom="";
    localStorage.removeItem("teacherMessageRoom");
    noticeState.messages=[];
  }
  render();
}
window.setNoticeUncheckedOnly = function(checked){if(!requireTeacherAccess()) return; noticeUncheckedOnly=!!checked; render();}
window.setTeacherMessageSearch = function(value){if(!requireTeacherAccess()) return; teacherMessageSearch=String(value||""); render();}
window.updateNoticeTypeFields = function(){
  const type=document.getElementById("noticeType")?.value || "notice";
  document.getElementById("noticeCheckItemsBox")?.classList.toggle("hidden",!["homework","material"].includes(type));
}
window.fillNoticeCheckPreset = function(kind){
  const el=document.getElementById("noticeCheckItems");
  if(!el) return;
  el.value = kind==="material" ? "교과서\n공책\n필통" : "교과서 문제 풀기\n공책 정리하기\n부모님 확인 받기";
}
window.resetNoticeForm = function(){
  ["noticeTitle","noticeContent","noticeCheckItems"].forEach(id=>{const el=document.getElementById(id); if(el) el.value="";});
  const due=document.getElementById("noticeDueDate"); if(due) due.value=today();
  const type=document.getElementById("noticeType"); if(type) type.value="notice";
  const important=document.getElementById("noticeImportant"); if(important) important.checked=false;
  const target=document.getElementById("noticeTargetType"); if(target) target.value="all";
  document.querySelectorAll(".noticeTargetStudent").forEach(el=>{el.checked=false;});
  document.getElementById("noticeTargetStudents")?.classList.add("hidden");
  updateNoticeTypeFields();
  const hint=document.getElementById("noticeSaveHint"); if(hint) hint.textContent="등록 버튼을 누르면 즉시 알림장에 저장됩니다.";
}
window.openTeacherNoticeDetail = function(id){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  selectedTeacherNoticeDetail=id;
  localStorage.setItem("teacherNoticeDetail",id);
  render();
}
window.closeTeacherNoticeDetail = function(){
  selectedTeacherNoticeDetail="";
  localStorage.removeItem("teacherNoticeDetail");
  render();
}

window.saveClassroomNotice = async function(){
  if(!requireTeacherAccess()) return;
  const title=String(document.getElementById("noticeTitle")?.value||"").trim();
  const content=String(document.getElementById("noticeContent")?.value||"").trim();
  const type=document.getElementById("noticeType")?.value || "notice";
  const targetType=document.getElementById("noticeTargetType")?.value || "all";
  const targetStudentIds=targetType==="selected" ? Array.from(document.querySelectorAll(".noticeTargetStudent:checked")).map(el=>el.value).filter(Boolean) : [];
  const due=document.getElementById("noticeDueDate")?.value || today();
  const important=!!document.getElementById("noticeImportant")?.checked;
  const checkItems=["homework","material"].includes(type)
    ? String(document.getElementById("noticeCheckItems")?.value||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,20)
    : [];
  if(!title) return toast("제목을 입력하세요.");
  if(!NOTICE_TYPES.some(t=>t.id===type)) return toast("알림 유형을 다시 선택하세요.");
  if(targetType==="selected" && !targetStudentIds.length) return toast("대상 학생을 선택하세요.");
  const btns=[...document.querySelectorAll('.noticeSubmitBtn, button[onclick="saveClassroomNotice()"]')];
  const hint=document.getElementById("noticeSaveHint");
  btns.forEach(btn=>{btn.disabled=true; btn.dataset.oldText=btn.textContent; btn.textContent="등록 중...";});
  if(hint) hint.textContent="Firebase에 저장하는 중입니다...";
  const id=txid();
  const nowText=seoulIsoString();
  const notice={
    id,title,content,type,targetType,targetStudentIds,
    dueDate:due,
    important,checkItems,createdBy:TEACHER_ID,createdAt:nowText,updatedAt:nowText,deleted:false
  };
  try{
    await dbUpdate("",{[`classroomNotices/${id}`]:notice});
    // Realtime Database 반영이 늦어도 교사 화면에는 즉시 보이게 로컬 상태도 보강한다.
    if(!noticeState.all.some(nc=>nc.id===id)) noticeState.all=[notice,...noticeState.all];
    toast("알림 등록 완료");
    resetNoticeForm();
    selectedTeacherNoticeTab="list";
    localStorage.setItem("teacherNoticeTab","list");
    if(hint) hint.textContent="등록 완료. 알림 목록으로 이동합니다.";
  }catch(e){
    console.error("notice save failed", e);
    const msg=e?.code ? `${e.code}: ${e.message || e}` : (e?.message || String(e));
    if(hint) hint.textContent=`등록 실패: ${msg}`;
    toast(`알림 등록 실패: ${msg}`);
  }finally{
    btns.forEach(btn=>{btn.disabled=false; btn.textContent=btn.dataset.oldText || "알림 등록"; delete btn.dataset.oldText;});
    render();
  }
}

window.editClassroomNotice = async function(id){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  const nc=noticeState.all.find(n=>n.id===id);
  if(!nc) return toast("알림을 찾을 수 없습니다.");
  const title=prompt("제목",nc.title||""); if(title===null) return;
  const content=prompt("내용",nc.content||""); if(content===null) return;
  const due=prompt("마감일/행사일 YYYY-MM-DD",noticeDateValue(nc.dueDate)||today()); if(due===null) return;
  try{
    await dbUpdate(`classroomNotices/${id}`,{
      title:String(title).trim()||nc.title,
      content:String(content).trim(),
      dueDate:due || today(),
      updatedAt:seoulIsoString()
    });
    toast("알림 수정 완료");
  }catch(e){
    console.error("notice edit failed", e);
    toast(`알림 수정 실패: ${e.message || e}`);
  }
}
window.deleteClassroomNotice = async function(id){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  if(!confirm("이 알림을 삭제할까요?")) return;
  try{
    await dbUpdate(`classroomNotices/${id}`,{deleted:true,updatedAt:seoulIsoString()});
    toast("알림 삭제 완료");
  }catch(e){
    console.error("notice delete failed", e);
    toast(`알림 삭제 실패: ${e.message || e}`);
  }
}
window.checkNotice = async function(noticeId,studentId){
  if(studentId!==selectedStudent) return toast("내 알림만 체크할 수 있습니다.");
  const nc=noticeState.student.find(n=>n.id===noticeId);
  if(!nc || !noticeAppliesToStudent(nc,studentId)) return toast("체크할 알림을 찾을 수 없습니다.");
  const previous=statusForNoticeStudent(noticeId,studentId);
  if(previous?.teacherConfirmed) return toast("이미 선생님 확인이 완료되었습니다.");
  const id=statusDocId(noticeId,studentId);
  try{
    await dbSet(`classroomNoticeStatus/${id}`,{
      id,noticeId,studentId,checked:true,checkedAt:seoulIsoString(),
      status:"self_checked"
    });
    toast("체크 완료");
  }catch(e){
    console.error("notice check failed", e);
    toast(`체크 실패: ${e.message || e}`);
  }
}
window.confirmNoticeStatus = async function(noticeId,studentId){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  const id=statusDocId(noticeId,studentId);
  const previous=obj(obj(data.classroomNoticeStatus)[id]);
  try{
    await dbSet(`classroomNoticeStatus/${id}`,{
      ...previous,id,noticeId,studentId,checked:true,
      checkedAt:previous.checkedAt || seoulIsoString(),
      teacherConfirmed:true,teacherConfirmedAt:seoulIsoString(),status:"confirmed"
    });
    toast("교사 확인 완료");
  }catch(e){
    console.error("notice confirm failed", e);
    toast(`교사 확인 실패: ${e.message || e}`);
  }
}
async function ensureStudentRoom(studentId){
  const roomId=`room_${studentId}`;
  const previous=obj(obj(data.teacherMessageRooms)[roomId]);
  await dbSet(`teacherMessageRooms/${roomId}`,{
    ...previous,id:roomId,studentId,studentName:studentName(studentId),teacherId:TEACHER_ID,
    createdAt:previous.createdAt || seoulIsoString(),updatedAt:seoulIsoString(),closed:false,
    unreadByTeacher:n(previous.unreadByTeacher),unreadByStudent:n(previous.unreadByStudent)
  });
  return roomId;
}
async function markRoomMessagesRead(roomId,readerRole){
  const updates={};
  noticeRecordList("teacherMessages").forEach(m=>{
    if(m.roomId!==roomId || m.deleted) return;
    if(readerRole==="teacher" && m.senderRole==="student" && !m.readByTeacher){
      updates[`teacherMessages/${m.id}/readByTeacher`]=true;
    }
    if(readerRole==="student" && m.senderRole==="teacher" && !m.readByStudent){
      updates[`teacherMessages/${m.id}/readByStudent`]=true;
    }
  });
  if(Object.keys(updates).length) await dbUpdate("",updates);
}
window.sendStudentTeacherMessage = async function(){
  if(!selectedStudent) return toast("학생 로그인이 필요합니다.");
  const nowMs=Date.now();
  if(nowMs-lastStudentMessageSentAt<10000) return toast("메시지는 10초에 한 번씩 보낼 수 있습니다.");
  const el=document.getElementById("studentTeacherMessageText");
  const text=String(el?.value||"").trim();
  if(!text) return toast("메시지를 입력하세요.");
  if(text.length>300) return toast("메시지는 300자 이내로 입력하세요.");
  const roomId=await ensureStudentRoom(selectedStudent);
  const msgId=txid();
  const room=obj(obj(data.teacherMessageRooms)[roomId]);
  try{
    await dbUpdate("",{
      [`teacherMessages/${msgId}`]:{
        id:msgId,roomId,senderId:selectedStudent,senderName:studentName(selectedStudent),senderRole:"student",
        text,createdAt:seoulIsoString(),readByTeacher:false,readByStudent:true,deleted:false
      },
      [`teacherMessageRooms/${roomId}/studentId`]:selectedStudent,
      [`teacherMessageRooms/${roomId}/studentName`]:studentName(selectedStudent),
      [`teacherMessageRooms/${roomId}/teacherId`]:TEACHER_ID,
      [`teacherMessageRooms/${roomId}/lastMessage`]:text,
      [`teacherMessageRooms/${roomId}/lastMessageAt`]:seoulIsoString(),
      [`teacherMessageRooms/${roomId}/lastSenderRole`]:"student",
      [`teacherMessageRooms/${roomId}/unreadByTeacher`]:n(room.unreadByTeacher)+1,
      [`teacherMessageRooms/${roomId}/unreadByStudent`]:0,
      [`teacherMessageRooms/${roomId}/updatedAt`]:seoulIsoString(),
      [`teacherMessageRooms/${roomId}/closed`]:false
    });
    lastStudentMessageSentAt=nowMs;
    if(el) el.value="";
    toast("메시지 전송 완료");
  }catch(e){
    console.error("student message failed", e);
    toast(`메시지 전송 실패: ${e.message || e}`);
  }
}
window.openTeacherMessageRoom = async function(roomId){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  if(!noticeState.rooms.some(r=>r.id===roomId)) return toast("메시지방을 찾을 수 없습니다.");
  selectedTeacherMessageRoom=roomId;
  localStorage.setItem("teacherMessageRoom",roomId);
  await markRoomMessagesRead(roomId,"teacher").catch(()=>{});
  await dbUpdate(`teacherMessageRooms/${roomId}`,{unreadByTeacher:0,updatedAt:seoulIsoString()}).catch(()=>{});
  render();
}
window.sendTeacherReply = async function(){
  if(!isTeacherMode()) return toast("교사 권한이 필요합니다.");
  const room=noticeState.rooms.find(r=>r.id===selectedTeacherMessageRoom);
  if(!room) return toast("메시지방을 선택하세요.");
  const el=document.getElementById("teacherReplyText");
  const text=String(el?.value||"").trim();
  if(!text) return toast("답장을 입력하세요.");
  if(text.length>300) return toast("답장은 300자 이내로 입력하세요.");
  const msgId=txid();
  try{
    await dbUpdate("",{
      [`teacherMessages/${msgId}`]:{
        id:msgId,roomId:room.id,senderId:TEACHER_ID,senderName:"선생님",senderRole:"teacher",
        text,createdAt:seoulIsoString(),readByTeacher:true,readByStudent:false,deleted:false
      },
      [`teacherMessageRooms/${room.id}/lastMessage`]:text,
      [`teacherMessageRooms/${room.id}/lastMessageAt`]:seoulIsoString(),
      [`teacherMessageRooms/${room.id}/lastSenderRole`]:"teacher",
      [`teacherMessageRooms/${room.id}/unreadByStudent`]:n(room.unreadByStudent)+1,
      [`teacherMessageRooms/${room.id}/unreadByTeacher`]:0,
      [`teacherMessageRooms/${room.id}/updatedAt`]:seoulIsoString(),
      [`teacherMessageRooms/${room.id}/closed`]:false
    });
    if(el) el.value="";
    toast("답장 전송 완료");
  }catch(e){
    console.error("teacher reply failed", e);
    toast(`답장 전송 실패: ${e.message || e}`);
  }
}
function peerDetailHtml(id){
  const s=student(id); if(!s) return `<p class="small">학생을 찾을 수 없습니다.</p>`;
  return `<div class="studentDetailGrid peerDetailGrid">
    <div>
      <div class="card peerAvatarCard">${avatarPreviewHtml(id)}</div>
      <div class="card creditDetailCard" style="margin-top:12px">${creditSummaryCard(id)}</div>
      <div class="card peerProfileCard" style="margin-top:12px">
        <h3>${s.name}</h3>
        <p class="small"><b>직업</b> ${studentJobName(s)||"없음"}</p>
        <p class="small"><b>보유 상품</b> ${inventoryHtml(id)}</p>
        <p class="small"><b>보유 티켓</b> ${ticketHtml(id)}</p>
        <p class="small"><b>적용 미니룸</b> ${selectedRoomTemplate(id)?.icon||"🏠"} ${selectedRoomTemplate(id)?.name||"없음"}</p>
      </div>
    </div>
    <div>
      <div class="section" style="padding:0;margin:0;box-shadow:none;border:0">
        <div class="head"><div><h3>자산 구성</h3><div class="sub">자산 정보는 표 대신 원형 그래프로 봅니다.</div></div></div>
        ${assetPieHtml(id)}
      </div>
      <div class="section" style="padding:0;margin-top:12px;box-shadow:none;border:0">
        <div class="head"><div><h3>최근 거래 내역</h3><div class="sub">최근 경제 활동 기록입니다.</div></div></div>
        ${studentRecentLedgerHtml(id,25)}
      </div>
      <div class="section" style="padding:0;margin-top:12px;box-shadow:none;border:0">
        <div class="head"><div><h3>일자별 소득</h3><div class="sub">날짜별 입금 합계입니다.</div></div></div>
        ${studentDailyIncomeHtml(id)}
      </div>
    </div>
  </div>`;
}
window.showPeerInfo = function(id){
  const s=student(id); if(!s) return;
  try{
    const c=creditScoreInfo(id);
    const rank=rankOfStudent(id);
    const rankText=rank==="-" ? "개인 순위 제외" : `개인 재산 ${rank}위`;
    document.getElementById("detailTitle").textContent=`${s.name} 구경하기`;
    document.getElementById("detailSub").textContent=`${studentJobName(s)||"직업 없음"} · ${rankText} · 신용 ${c.grade} ${c.score}점`;
    document.getElementById("detailBody").innerHTML=peerDetailHtml(id);
    document.getElementById("detailModal").classList.remove("hidden");
  }catch(e){
    console.error("peer detail render error", e);
    document.getElementById("detailTitle").textContent=`${s.name} 구경하기`;
    document.getElementById("detailSub").textContent="학생 상세 정보를 여는 중 일부 오류가 있었습니다.";
    document.getElementById("detailBody").innerHTML=`<div class="section"><h3>${s.name}</h3><p class="small">${e?.message || String(e)}</p></div>`;
    document.getElementById("detailModal").classList.remove("hidden");
  }
}
window.studentLogin = function(){
  const id=document.getElementById("loginStudent").value, pin=document.getElementById("loginPin").value;
  if(!id) return toast("이름을 선택하세요.");
  if((student(id)?.pin||"") !== pin) return toast("PIN이 틀렸습니다.");
  selectedStudent=id; localStorage.setItem("selectedStudent",id); render();
}
window.studentLogout = function(){selectedStudent=""; localStorage.removeItem("selectedStudent"); render();}

function requestNeededCash(r){
  if(!r) return 0;
  if(r.type==="transfer") return money(r.amount);
  if(r.type==="retailBuy") return money(n(r.qty)*n(r.unitPrice) + tax(n(r.qty)*n(r.unitPrice)));
  if(r.type==="ticketBuy") return ticketBuy(r.ticketId);
  if(r.type==="bondBuy"){ const i=obj(data.bondIssues)[r.issueId]; return money(i?.principal ?? r.amount); }
  if(r.type==="savingsStart") return 0;
  if(r.type==="loanApply") return 0;
  if(r.type==="depositIn") return money(r.amount);
  return 0;
}
function validateRequestBalance(r){
  const actor=r?.studentId || selectedStudent;
  if(!actor) return toast("학생을 먼저 선택하세요."), false;
  const cashNeed=requestNeededCash(r);
  if(cashNeed>0 && !requireCash(actor,cashNeed)) return false;
  if(r.type==="transfer"){
    if(!r.to || r.to===actor) return toast("받는 친구를 확인하세요."), false;
    if(n(r.amount)<=0) return toast("송금액을 확인하세요."), false;
  }
  if(r.type==="retailBuy"){
    if(!r.seller || r.seller===selectedStudent) return toast("판매자를 확인하세요."), false;
    if(!r.productId || !product(r.productId)) return toast("상품을 확인하세요."), false;
    if(n(r.qty)<=0 || n(r.unitPrice)<=0) return toast("수량과 가격을 확인하세요."), false;
    const sellerInv=n(obj(obj(data.inventories)[r.seller])[r.productId]);
    if(sellerInv<n(r.qty)) return toast("판매자 보유 수량이 부족합니다."), false;
  }
  if(r.type==="ticketBuy"){
    if(ticketStock(r.ticketId)<=0) return toast("티켓 재고가 없어 구매 신청할 수 없습니다."), false;
  }
  if(r.type==="ticketSell" || r.type==="ticketUse"){
    const holding=n(obj(obj(data.ticketHoldings)[actor])[r.ticketId]);
    if(holding<=0) return toast("보유한 티켓이 없습니다."), false;
  }
  if(r.type==="bondBuy"){
    const i=obj(data.bondIssues)[r.issueId];
    if(!i) return toast("구매할 채권을 선택하세요."), false;
    if((i.status||"active")!=="active") return toast("판매 중인 채권이 아닙니다."), false;
    if(n(i.remaining)<=0) return toast("채권 재고가 없습니다."), false;
  }
  if(r.type==="savingsStart"){
    if(n(r.amount)<=0) return toast("적금 가입 금액을 확인하세요."), false;
  }
  if(r.type==="loanApply"){
    const limit=loanLimitInfo(actor).available;
    if(n(r.amount)<=0) return toast("대출 신청 금액을 확인하세요."), false;
    if(n(r.amount)>limit) return toast(`대출 한도 초과: 가능 ${won(limit)}`), false;
  }
  if(r.type==="depositOut"){
    if(n(obj(data.deposits)[actor]) < money(r.amount)) return toast(`예금 잔액 부족: 현재 ${won(obj(data.deposits)[actor]||0)}`), false;
  }
  return true;
}
function confirmPurchaseMessage(title, amount){
  if(!cfgBool("ux.requirePurchaseConfirm",true)) return true;
  return confirm(`${title}\n\n금액: ${won(amount)}\n\n구매하시겠습니까?`);
}



async function doSavingsStart(studentId,amount,days=21,rate=Math.round(savingsRate()*100)){
  const installment=money(amount);
  days=Math.max(21,Math.floor(n(days)||21));
  rate=n(rate)||Math.round(savingsRate()*100);
  if(!studentId||installment<=0) return false;
  const start=new Date(), mature=new Date(start); mature.setDate(mature.getDate()+days);
  const id="saving_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  await dbSet("savings/"+id,{
    id,
    owner:studentId,
    installment,
    amount:installment,
    totalPaid:0,
    balance:0,
    rate,
    days,
    start:localDateString(start),
    mature:localDateString(mature),
    nextPayDate:localDateString(start),
    lastInterestAt:localDateString(start),
    status:"active"
  });
  await addLedger("적금개설",`${studentName(studentId)} 적금 개설: ${SAVING_PAYMENT_INTERVAL_DAYS}일마다 ${won(installment)} 납입`,[],{savingId:id,installment,days,rate});
  return true;
}
async function doLoanApprove(r,rate,bankerId=""){
  const amount=money(r.amount);
  const studentId=r.studentId;
  if(!studentId||amount<=0) return false;
  const limit=loanLimitInfo(studentId).available;
  if(amount>limit) return toast(`대출 한도 초과: 가능 ${won(limit)}`), false;
  rate=Math.max(0,n(rate));
  const days=Math.max(1,Math.floor(n(r.days)||7));
  const start=new Date(), due=new Date(start); due.setDate(due.getDate()+days);
  const id="loan_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  await dbSet("loans/"+id,{id,owner:studentId,amount,rate,days,purpose:r.purpose||"",bankerId,start:start.toISOString().slice(0,10),due:due.toISOString().slice(0,10),status:"active"});
  await addLedger("대출실행",`${studentName(studentId)} 대출 실행`,[{account:CENTRAL,delta:-amount},{account:studentId,delta:amount}],{loanId:id,bankerId,rate});
  return true;
}

async function addRequest(r){
  if(!validateRequestBalance(r)) return;
  const id="req_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
  await dbSet("requests/"+id,{id,ts:seoulIsoString(),...r});
  toast("신청했습니다. 선생님 승인을 기다리세요.");
}
window.requestTransfer = async function(){
  const r={type:"transfer",studentId:selectedStudent,to:document.getElementById("reqTo").value,amount:n(document.getElementById("reqAmount").value)};
  if(!validateRequestBalance(r)) return;
  if(!confirm(`${studentName(r.to)}에게 ${won(r.amount)} 송금하시겠습니까?`)) return;
  if(await doTransfer(r.studentId,r.to,r.amount,"학생 직접 송금")) toast("송금 완료");
}
window.requestRetailBuy = async function(){
  const productId=document.getElementById("reqProduct")?.value;
  const r={type:"retailBuy",studentId:selectedStudent,seller:document.getElementById("reqSeller")?.value,productId,qty:n(document.getElementById("reqQty")?.value),unitPrice:productPrice(product(productId))};
  const total=requestNeededCash(r);
  if(!validateRequestBalance(r)) return;
  if(!confirmPurchaseMessage(`${product(r.productId)?.name||"상품"} ${r.qty}개 구매 신청`, total)) return;
  await addRequest(r);
}
window.requestBondIssue = async function(issueId){
  const i=obj(data.bondIssues)[issueId];
  if(!i) return toast("구매할 채권을 선택하세요.");
  const r={type:"bondBuy",studentId:selectedStudent,issueId,amount:n(i.principal),rate:n(i.rate)};
  if(!validateRequestBalance(r)) return;
  if(!confirmPurchaseMessage(`${bondIssueName(i)} 채권 구매 신청`, n(i.principal))) return;
  await addRequest(r);
}
window.requestBond = async function(){
  const issueId=document.getElementById("reqBondIssue")?.value;
  return window.requestBondIssue(issueId);
}
window.requestDepositIn = async function(){
  const r={type:"depositIn",studentId:selectedStudent,amount:n(document.getElementById("reqDepositAmount").value)};
  await addRequest(r);
}
window.requestDepositOut = async function(){
  const r={type:"depositOut",studentId:selectedStudent,amount:n(document.getElementById("reqDepositAmount").value)};
  await addRequest(r);
}
window.requestSavingStart = async function(){
  const r={type:"savingsStart",studentId:selectedStudent,amount:n(document.getElementById("reqSavingAmount")?.value),days:n(document.getElementById("reqSavingDays")?.value)||7,rate:Math.round(savingsRate()*100)};
  if(!validateRequestBalance(r)) return;
  if(!confirm(`2일마다 ${won(r.amount)}씩 납입하는 ${n(r.days)}일 적금을 개설 신청할까요?\n개설 시 돈은 빠지지 않고, 납입 버튼을 누를 때마다 차감됩니다.\n중도해지 시 환급액은 0열매입니다.`)) return;
  await addRequest(r);
}
window.requestLoanApply = async function(){
  const r={type:"loanApply",studentId:selectedStudent,amount:n(document.getElementById("reqLoanAmount")?.value),purpose:(document.getElementById("reqLoanPurpose")?.value||"").trim(),days:7};
  if(!validateRequestBalance(r)) return;
  if(!confirm(`${won(r.amount)} 대출을 신청할까요?\n은행장이 금리를 정해 승인합니다.`)) return;
  await addRequest(r);
}
window.requestTicketBuy = async function(k){
  const r={type:"ticketBuy",studentId:selectedStudent,ticketId:k};
  const price=ticketBuy(k);
  if(!validateRequestBalance(r)) return;
  if(!confirmPurchaseMessage(`${ticketMeta[k]?.name||"티켓"} 구매 신청`, price)) return;
  await addRequest(r);
}
window.requestTicketSell = async function(k){
  await addRequest({type:"ticketSell",studentId:selectedStudent,ticketId:k});
}
window.requestTicketUse = async function(k){
  await addRequest({type:"ticketUse",studentId:selectedStudent,ticketId:k});
}
window.cancelRequest = async function(id){
  const r=obj(data.requests)[id];
  if(!r) return;
  if(r.studentId!==selectedStudent && mode!=="teacher") return toast("본인 신청만 취소할 수 있습니다.");
  await dbRemove("requests/"+id);
  toast("신청을 취소했습니다.");
}
window.approveRequest = async function(id){
  const r=obj(data.requests)[id]; if(!r) return; let ok=false;
  const need=requestNeededCash(r);
  const msg=`${studentName(r.studentId)} 학생의 ${requestTypeName(r.type)} 신청을 승인할까요?\n\n${requestDesc(r)}${need>0?`\n필요 금액: ${won(need)}`:""}`;
  if(!confirm(msg)) return;
  if(!validateRequestBalance({...r,studentId:r.studentId})) return;
  if(r.type==="transfer") ok=await doTransfer(r.studentId,r.to,r.amount,"학생 신청 송금");
  if(r.type==="retailBuy") ok=await doRetailPurchase(r.studentId,r.seller,r.productId,r.qty,r.unitPrice);
  if(r.type==="ticketBuy") ok=await doTicketBuy(r.studentId,r.ticketId);
  if(r.type==="ticketSell") ok=await doTicketSell(r.studentId,r.ticketId);
  if(r.type==="ticketUse") ok=await doTicketUse(r.studentId,r.ticketId);
  if(r.type==="bondBuy") ok=await doBondBuy(r.studentId,r.amount,r.rate,r.issueId);
  if(r.type==="depositIn") ok=await doDepositIn(r.studentId,r.amount);
  if(r.type==="depositOut") ok=await doDepositOut(r.studentId,r.amount);
  if(r.type==="savingsStart") ok=await doSavingsStart(r.studentId,r.amount,r.days,r.rate);
  if(r.type==="loanApply") ok=await doLoanApprove(r,n(r.rate)||suggestedLoanRate(r.studentId),"teacher");
  if(ok){await dbRemove("requests/"+id); toast("승인 완료");}
}
window.rejectRequest = async function(id){await dbRemove("requests/"+id); toast("거절 완료");}


function historyWithNow(){
  return fullHistoryWithNow().slice(-16);
}
function chartCanvasContext(preferredHeight=420){
  const canvas=document.getElementById('chartCanvas');
  if(!canvas) return null;
  const mobile=(typeof isMobileViewport==="function" ? isMobileViewport() : window.innerWidth<=768);
  const rect=canvas.getBoundingClientRect();
  const cssW=Math.max(280,Math.round(rect.width || canvas.clientWidth || (mobile?360:900)));
  const rectH=rect.height || canvas.clientHeight || preferredHeight;
  const cssH=Math.max(mobile?280:340,Math.min(Math.round(rectH || preferredHeight),mobile?360:540));
  const dpr=Math.max(1,Math.min(2,window.devicePixelRatio || 1));
  const nextW=Math.round(cssW*dpr), nextH=Math.round(cssH*dpr);
  if(canvas.width!==nextW || canvas.height!==nextH){ canvas.width=nextW; canvas.height=nextH; }
  canvas.style.width='100%';
  canvas.style.height=cssH+'px';
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {canvas,ctx,W:cssW,H:cssH,mobile};
}

function drawLineChart(series, labels){
  const chart=chartCanvasContext(); if(!chart) return;
  const {ctx,W,H,mobile}=chart;
  const pad=mobile?{l:52,r:14,t:24,b:52}:{l:70,r:20,t:20,b:60};
  ctx.clearRect(0,0,W,H); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  const vals=series.flatMap(s=>s.values).filter(v=>Number.isFinite(v));
  let min=0,max=Math.max(...vals,1); max=Math.ceil(max/100)*100 || 1;
  ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1; ctx.fillStyle='#64748b'; ctx.font='12px system-ui'; ctx.textAlign='left';
  for(let i=0;i<=5;i++){ const y=pad.t+(H-pad.t-pad.b)*i/5; const val=max-(max-min)*i/5; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke(); ctx.fillText(Math.round(val).toLocaleString('ko-KR'),8,y+4); }
  const xFor=i=>pad.l+(W-pad.l-pad.r)*(labels.length===1?0.5:i/(labels.length-1));
  const yFor=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/(max-min));
  labels.forEach((lab,i)=>{ctx.fillStyle='#64748b'; ctx.textAlign='center'; ctx.font='11px system-ui'; ctx.fillText(lab,xFor(i),H-26);});
  series.forEach(s=>{ ctx.strokeStyle=s.color; ctx.lineWidth=4; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.beginPath(); s.values.forEach((v,i)=>{const x=xFor(i),y=yFor(v); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);}); ctx.stroke(); s.values.forEach((v,i)=>{ctx.fillStyle=s.color; ctx.beginPath(); ctx.arc(xFor(i),yFor(v),5,0,Math.PI*2); ctx.fill();}); });
}
function drawTotalIncomeChart(rows){
  const chart=chartCanvasContext(); if(!chart) return;
  const {ctx,W,H,mobile}=chart;
  const pad=mobile?{l:56,r:18,t:34,b:58}:{l:96,r:40,t:46,b:92};
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fbfdf9'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#ffffff'; ctx.fillRect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b);
  if(!rows.length){
    ctx.fillStyle='#64748b'; ctx.font=`${mobile?14:22}px system-ui`; ctx.textAlign='center'; ctx.fillText('표시할 전체 열매 보유량 기록이 없습니다.',W/2,H/2);
    return;
  }
  const vals=rows.map(r=>n(r.totalHoldings));
  let min=Math.min(...vals), max=Math.max(...vals);
  if(max===min){max+=1; min=Math.max(0,min-1);}
  const extra=(max-min)*0.12 || 1; min=Math.max(0,min-extra); max+=extra;
  const range=max-min;
  const xFor=i=>pad.l+(W-pad.l-pad.r)*(rows.length===1?0.5:i/(rows.length-1));
  const yFor=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  ctx.strokeStyle='rgba(143,159,132,.32)'; ctx.lineWidth=1; ctx.fillStyle='#6b7466'; ctx.font=`${mobile?10:13}px system-ui`; ctx.textAlign='right';
  const gridCount=mobile?4:6;
  for(let i=0;i<=gridCount;i++){
    const y=pad.t+(H-pad.t-pad.b)*i/gridCount;
    const val=max-range*i/gridCount;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    ctx.fillText(Math.round(val).toLocaleString('ko-KR'),pad.l-7,y+4);
  }
  ctx.strokeStyle='#2f6df6'; ctx.lineWidth=mobile?4:7; ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath();
  rows.forEach((r,i)=>{const x=xFor(i), y=yFor(r.totalHoldings); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.stroke();
  rows.forEach((r,i)=>{
    const x=xFor(i), y=yFor(r.totalHoldings);
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x,y,mobile?5:8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#2f6df6'; ctx.lineWidth=mobile?2.5:4; ctx.stroke();
  });
  const labelLimit=mobile?4:9;
  const labelEvery=Math.max(1,Math.ceil(rows.length/labelLimit));
  rows.forEach((r,i)=>{
    if(i%labelEvery!==0 && i!==rows.length-1) return;
    ctx.fillStyle='#596552'; ctx.font=`${mobile?10:12}px system-ui`; ctx.textAlign='center';
    ctx.fillText(r.day.slice(5).replace('-','/'),xFor(i),H-(mobile?18:28));
  });
  const last=rows[rows.length-1];
  const prev=rows[rows.length-2];
  const diff=prev ? n(last.totalHoldings)-n(prev.totalHoldings) : 0;
  const rate=prev && n(prev.totalHoldings)>0 ? diff/n(prev.totalHoldings)*100 : 0;
  ctx.textAlign='right'; ctx.font=`800 ${mobile?12:15}px system-ui`;
  ctx.fillStyle=diff>=0?'#16a34a':'#dc2626';
  ctx.fillText(`최근 ${won(last.totalHoldings)} · ${signedWon(diff)} (${pct(rate)})`,W-pad.r,pad.t-12);
  if(!mobile){
    ctx.fillStyle='#334155'; ctx.font='13px system-ui'; ctx.textAlign='left';
    ctx.fillText('전체 열매 = 학생 지갑 + 예금 + 적금 + 채권 + 단체 현금',pad.l,H-28);
  }
}
function showTotalIncomeChart(limit=null){
  const rows=economyHistoryRows(limit || null);
  document.getElementById('chartTitle').textContent='전체 열매 보유량 변화';
  document.getElementById('chartSub').textContent='날짜별 전체 보유량, 전날 대비 변화량, 등락률을 확인합니다.';
  document.getElementById('chartModal').classList.remove('hidden');
  requestAnimationFrame(()=>drawTotalIncomeChart(rows));
}
window.showEconomyHelp = function(){
  const title=document.getElementById("detailTitle");
  const sub=document.getElementById("detailSub");
  const body=document.getElementById("detailBody");
  if(title) title.textContent="우리 반 경제지수 도움말";
  if(sub) sub.textContent="전체 열매 보유량과 티켓 가격이 정해지는 방식";
  if(body) body.innerHTML=`<div class="economyHelpBox">
    <p>우리 반 경제지수는 우리 반 전체가 가진 열매의 총합입니다.</p>
    <p>전체 열매가 많아지면 우리 반 경제가 커진 것이고, 전체 열매가 줄어들면 세금, 티켓, 과자 구매 등으로 열매가 많이 사라진 것입니다.</p>
    <p>티켓 가격은 세 가지 힘으로 정해집니다.</p>
    <ol>
      <li>우리 반 전체가 얼마나 부자인가</li>
      <li>오늘 새로 열매가 얼마나 풀렸는가</li>
      <li>사고 싶은 사람이 많은가, 팔고 싶은 사람이 많은가</li>
    </ol>
    <p>하지만 가격이 하루 만에 너무 많이 오르거나 떨어지지 않도록 안전장치가 있습니다.</p>
  </div>`;
  document.getElementById("detailModal")?.classList.remove("hidden");
}

window.showCreditHelp = function(){
  const title=document.getElementById("detailTitle");
  const sub=document.getElementById("detailSub");
  const body=document.getElementById("detailBody");
  if(title) title.textContent="신용도 도움말";
  if(sub) sub.textContent="경제교실에서 돈·약속·역할을 얼마나 믿고 맡길 수 있는지 보여주는 점수";
  if(body) body.innerHTML=`<div class="economyHelpBox creditHelpBox creditHelpBoxV119">
    <div class="notice creditHelpNoticeV119"><b>경고와 신용도</b><span>경찰 경고는 신용도에 영향이 있습니다. 심판 경고는 경기/활동 중 주의 기록으로 남지만 신용도 계산에는 사용하지 않습니다.</span></div>
    <p class="creditHelpLeadV119"><b>신용도</b>는 벌점이 아니라, 경제교실에서 돈·약속·역할을 믿고 맡길 수 있는 정도입니다.</p>
    <div class="creditGradeGridV119" aria-label="신용도 등급표">
      <div class="creditGradeCardV119 top"><b>S</b><span>900~1000</span><em>매우 신뢰 가능</em></div>
      <div class="creditGradeCardV119 good"><b>A</b><span>800~899</span><em>신뢰 높음</em></div>
      <div class="creditGradeCardV119 normal"><b>B</b><span>700~799</span><em>보통</em></div>
      <div class="creditGradeCardV119 warn"><b>C</b><span>600~699</span><em>주의</em></div>
      <div class="creditGradeCardV119 danger"><b>D</b><span>500~599</span><em>위험</em></div>
      <div class="creditGradeCardV119 danger"><b>E</b><span>300~499</span><em>신용 제한</em></div>
    </div>
    <div class="creditHelpTwoColV119">
      <section class="creditHelpPanelV119">
        <h3>신용도가 내려가는 경우</h3>
        <ol>
          <li>경고를 받거나 같은 문제가 반복될 때</li>
          <li>직업 역할을 하지 않아 직무유기 단계가 올라갈 때</li>
          <li>벌금을 기한 안에 내지 않거나 미납 벌금이 남아 있을 때</li>
          <li>세금 회피, 거래 약속 불이행, 법인 돈 사적 사용처럼 경제 약속을 어길 때</li>
          <li>대출을 많이 사용해 갚아야 할 부담이 커질 때</li>
        </ol>
      </section>
      <section class="creditHelpPanelV119">
        <h3>신용도를 회복하는 방법</h3>
        <ol>
          <li>며칠 동안 경고 없이 생활하기</li>
          <li>직업 역할을 성실하게 수행하기</li>
          <li>벌금과 미납금을 납부하기</li>
          <li>거래 약속, 세금 납부, 법인 회계 기록을 정확히 지키기</li>
          <li>예금·적금·채권처럼 책임 있는 금융활동을 꾸준히 유지하기</li>
        </ol>
      </section>
    </div>
    <p class="creditHelpClosingV119">한 번 실수했다고 끝나는 것은 아닙니다. 성실하게 생활하고 미납금을 해결하면 신용도는 다시 올라갑니다.</p>
    <p class="small creditHelpSmallV119">현재 신용도는 자산, 최근 소득, 경고 기록, 직무유기, 세금 적발, 대출 부담, 미납 벌금, 성실 회복 기록을 종합해 계산합니다.</p>
  </div>`;
  document.getElementById("detailModal")?.classList.remove("hidden");
}

function dailyProductCandles(productId){
  const h=historyWithNow().map(x=>{
    const has=!!(x.products && x.products[productId]);
    if(!has && x.id!=="now") return null;
    return {day:(x.iso||"").slice(0,10)||today(), value:n(x.products?.[productId]?.price ?? money(productPrice(product(productId))))};
  }).filter(Boolean).filter(x=>Number.isFinite(x.value));
  const days={};
  h.forEach(x=>{
    if(!days[x.day]) days[x.day]={day:x.day,open:x.value,high:x.value,low:x.value,close:x.value};
    days[x.day].high=Math.max(days[x.day].high,x.value);
    days[x.day].low=Math.min(days[x.day].low,x.value);
    days[x.day].close=x.value;
  });
  return Object.values(days).sort((a,b)=>a.day.localeCompare(b.day)).slice(-16);
}
function drawCandles(candles){
  const chart=chartCanvasContext(); if(!chart) return;
  const {ctx,W,H,mobile}=chart;
  const pad=mobile?{l:56,r:18,t:32,b:64}:{l:96,r:34,t:42,b:104};
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#111827'; ctx.fillRect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b);
  if(!candles.length){
    ctx.fillStyle='#cbd5e1'; ctx.font='20px system-ui'; ctx.textAlign='center'; ctx.fillText('표시할 가격 기록이 없습니다.',W/2,H/2);
    return;
  }
  const vals=candles.flatMap(c=>[n(c.open),n(c.high),n(c.low),n(c.close)]);
  let min=Math.min(...vals), max=Math.max(...vals); if(max===min){max+=1; min=Math.max(0,min-1);}
  const extra=(max-min)*0.08 || 1; min=Math.max(0,min-extra); max+=extra;
  const range=max-min;
  const xFor=i=>pad.l+(W-pad.l-pad.r)*(candles.length===1?0.5:i/(candles.length-1));
  const yFor=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  const bw=Math.max(14,Math.min(44,(W-pad.l-pad.r)/Math.max(1,candles.length)*0.56));
  ctx.strokeStyle='rgba(148,163,184,.28)'; ctx.lineWidth=1; ctx.fillStyle='#cbd5e1'; ctx.font='13px system-ui'; ctx.textAlign='right';
  for(let i=0;i<=6;i++){
    const y=pad.t+(H-pad.t-pad.b)*i/6;
    const val=max-range*i/6;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    ctx.fillText(Math.round(val).toLocaleString('ko-KR'),pad.l-12,y+5);
  }
  ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,H-pad.b); ctx.lineTo(W-pad.r,H-pad.b); ctx.stroke();
  const labelEvery=Math.max(1,Math.ceil(candles.length/8));
  candles.forEach((c,i)=>{
    const x=xFor(i), yo=yFor(c.open), yc=yFor(c.close), yh=yFor(c.high), yl=yFor(c.low);
    const color=c.close>c.open?'#ef4444':c.close<c.open?'#2563eb':'#64748b';
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(x,yh); ctx.lineTo(x,yl); ctx.stroke();
    const top=Math.min(yo,yc), height=Math.max(7,Math.abs(yc-yo));
    ctx.fillRect(x-bw/2,top,bw,height);
    ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=1.2; ctx.strokeRect(x-bw/2,top,bw,height);
    if(i%labelEvery===0 || i===candles.length-1){
      ctx.save();
      ctx.translate(x,H-62);
      ctx.rotate(-Math.PI/4);
      ctx.fillStyle='#e2e8f0'; ctx.font='13px system-ui'; ctx.textAlign='right';
      ctx.fillText((c.day||'').slice(5).replace('-','/'),0,0);
      ctx.restore();
    }
  });
  const last=candles[candles.length-1];
  ctx.fillStyle='#e2e8f0'; ctx.font='13px system-ui'; ctx.textAlign='left';
  ctx.fillText('빨강: 상승 / 파랑: 하락 / 회색: 변동 없음',pad.l,H-24);
  ctx.textAlign='right'; ctx.font='700 13px system-ui';
  ctx.fillText(`최근 종가 ${won(last.close)} · 고가 ${won(last.high)} · 저가 ${won(last.low)}`,W-pad.r,H-24);
}
function showProductChart(productId){
  const p=product(productId); if(!p) return toast('상품을 찾을 수 없습니다.');
  document.getElementById('chartTitle').textContent=`${p.name} 가격 캔들 차트`;
  const candles=dailyProductCandles(productId);
  const latest=candles[candles.length-1];
  document.getElementById('chartSub').textContent = latest ? `일자별 시가·고가·저가·종가 · 최근 종가 ${won(latest.close)}` : '일자별 시가·고가·저가·종가';
  document.getElementById('chartModal').classList.remove('hidden');
  requestAnimationFrame(()=>drawCandles(candles));
}
function dailyTicketPriceRows(ticketId,limit=30){
  const days={};
  economyHistoryRows(null).forEach(r=>{
    const info=obj(r.ticketPrices)[ticketId];
    if(info && n(info.close)>0) days[r.day]={day:r.day,...info};
  });
  fullHistoryWithNow().forEach(x=>{
    const day=(x.iso||"").slice(0,10)||today();
    const info=obj(obj(x.tickets)[ticketId]);
    if(info && n(info.buy)>0 && !days[day]){
      const close=money(info.close ?? info.buy);
      const open=money(info.open || close);
      const change=money(close-open);
      days[day]={day,open,close,high:money(info.high||Math.max(open,close)),low:money(info.low||Math.min(open,close)),change,changeRate:open>0?change/open*100:0,buyOrders:n(info.buyOrders),sellOrders:n(info.sellOrders)};
    }
  });
  return Object.values(days).sort((a,b)=>a.day.localeCompare(b.day)).slice(limit ? -limit : undefined);
}
function drawTicketLineChart(rows,ticketId){
  const chart=chartCanvasContext(); if(!chart) return;
  const {ctx,W,H,mobile}=chart;
  const pad=mobile?{l:56,r:18,t:34,b:64}:{l:112,r:44,t:50,b:118};
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#f8fafc'; ctx.fillRect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b);
  if(!rows.length){
    ctx.fillStyle='#64748b'; ctx.font='22px system-ui'; ctx.textAlign='center'; ctx.fillText('표시할 티켓 가격 기록이 없습니다.',W/2,H/2);
    return;
  }
  const vals=rows.map(r=>n(r.close));
  let min=Math.min(...vals), max=Math.max(...vals);
  if(max===min){max+=1; min=Math.max(0,min-1);}
  const extra=(max-min)*0.14 || 1; min=Math.max(0,min-extra); max+=extra;
  const range=max-min;
  const xFor=i=>pad.l+(W-pad.l-pad.r)*(rows.length===1?0.5:i/(rows.length-1));
  const yFor=v=>pad.t+(H-pad.t-pad.b)*(1-(v-min)/range);
  ctx.strokeStyle='rgba(148,163,184,.35)'; ctx.lineWidth=1.2; ctx.fillStyle='#475569'; ctx.font='16px system-ui'; ctx.textAlign='right';
  for(let i=0;i<=6;i++){
    const y=pad.t+(H-pad.t-pad.b)*i/6;
    const val=max-range*i/6;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    ctx.fillText(Math.round(val).toLocaleString('ko-KR'),pad.l-12,y+5);
  }
  const color=ticketMeta[ticketId]?.color || '#2563eb';
  ctx.strokeStyle=color; ctx.lineWidth=7; ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath();
  rows.forEach((r,i)=>{const x=xFor(i), y=yFor(r.close); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);});
  ctx.stroke();
  rows.forEach((r,i)=>{
    const x=xFor(i), y=yFor(r.close);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=color; ctx.lineWidth=4; ctx.stroke();
  });
  const labelEvery=Math.max(1,Math.ceil(rows.length/10));
  rows.forEach((r,i)=>{
    if(i%labelEvery!==0 && i!==rows.length-1) return;
    ctx.save(); ctx.translate(xFor(i),H-72); ctx.rotate(-Math.PI/4);
    ctx.fillStyle='#334155'; ctx.font='15px system-ui'; ctx.textAlign='right';
    ctx.fillText(r.day.slice(5).replace('-','/'),0,0);
    ctx.restore();
  });
  const last=rows[rows.length-1];
  if(!mobile){
    ctx.fillStyle='#334155'; ctx.font='15px system-ui'; ctx.textAlign='left';
    ctx.fillText('선 그래프: 하루 한 번 정해지는 티켓 가격에 맞춘 표시입니다.',pad.l,H-28);
  }
  ctx.textAlign='right'; ctx.font=`800 ${mobile?12:16}px system-ui`;
  ctx.fillStyle=n(last.change)>=0?'#16a34a':'#dc2626';
  ctx.fillText(`${won(last.close)} · ${signedWon(last.change)} (${pct(last.changeRate)})${mobile?'':` · 구매 ${n(last.buyOrders)} / 판매 ${n(last.sellOrders)}`}`,W-pad.r,mobile?pad.t-12:H-28);
}
function showTicketChart(ticketId){
  const m=ticketMeta[ticketId];
  const rows=dailyTicketPriceRows(ticketId,30);
  const latest=rows[rows.length-1];
  document.getElementById('chartTitle').textContent=`${m.name} 가격 차트`;
  document.getElementById('chartSub').textContent=latest ? `${latest.day} 현재 ${won(latest.close)} · ${signedWon(latest.change)} / ${pct(latest.changeRate)} · 구매신청 ${n(latest.buyOrders)}명 · 판매신청 ${n(latest.sellOrders)}명` : '날짜별 티켓 가격';
  document.getElementById('chartModal').classList.remove('hidden');
  requestAnimationFrame(()=>drawTicketLineChart(rows,ticketId));
}
function hideChart(){ document.getElementById('chartModal').classList.add('hidden'); }

window.showAvatarPreviewLarge = function(itemId){
  const it=avatarItemById(itemId);
  if(!it) return toast("아바타를 찾을 수 없습니다.");
  const studentId=selectedStudent;
  const owned=studentId && ownedAvatarCount(studentId,itemId)>0;
  const equipped=studentId && equippedAvatarItem(studentId,itemId);
  const actionHtml=studentId ? (owned
    ? `<button class="${equipped?'green':'blue'}" onclick="equipAvatarItem('${studentId}','${itemId}')">${equipped?'적용중':'적용하기'}</button>`
    : `<button class="primary" onclick="buyAvatarItem('${studentId}','${itemId}')">구매하기</button>`) : "";
  const title=document.getElementById("detailTitle");
  const sub=document.getElementById("detailSub");
  const body=document.getElementById("detailBody");
  if(title) title.textContent=it.name;
  if(sub) sub.textContent=`${cosmeticRarityLabel(it)} · ${won(cosmeticPrice(it))}`;
  const fullAvatarHtml = avatarImageSrc(it)
    ? `<img class="largeAvatarFullImg" src="${avatarImageSrc(it)}" alt="${it.name}">`
    : itemThumb(it);
  if(body) body.innerHTML=`<div class="largeAvatarPreview fullAvatarModal"><div class="largeAvatarStage">${fullAvatarHtml}</div><div class="largeAvatarInfo"><h3>${it.name}</h3><p class="small">전체 아바타를 큰 화면에서 확인한 뒤 구매하거나 바로 적용할 수 있습니다.</p><div class="toolbar"><span class="pill ${rarityPillClass(it.rarity)}">${cosmeticRarityLabel(it)}</span><span class="pill">${owned?"보유중":"미보유"}</span><span class="pill blue">${won(cosmeticPrice(it))}</span></div>${avatarCreatorLineHtml(it)}<div class="toolbar" style="margin-top:14px">${actionHtml}<button onclick="hideStudentDetail()">닫기</button></div></div></div>`;
  document.getElementById("detailModal")?.classList.remove("hidden");
}
window.useTopDisplayPass = async function(){
  const studentId=selectedStudent;
  const qty=Math.max(1,Math.floor(n(document.getElementById("marketBoostUseQty")?.value)||1));
  const holding=n(obj(obj(data.ticketHoldings)[studentId]).topDisplay);
  if(!studentId) return toast("학생을 선택하세요.");
  if(holding<qty) return toast(`상단 표시권 부족: 보유 ${holding}장`);
  if(!confirm(`상단 표시권 ${qty}장을 사용해 오늘 시장 첫 화면에서 판매자 순서를 올릴까요?`)) return;
  const used=marketBoostCount(studentId);
  const updates={};
  updates[`ticketHoldings/${studentId}/topDisplay`]=holding-qty;
  updates[`marketBoosts/${today()}/${studentId}`]=used+qty;
  await dbUpdate("",updates);
  await addLedger("상단표시권사용",`${studentName(studentId)} 상단 표시권 ${qty}장 사용`,[],{qty});
  toast("상단 표시권 사용 완료");
}

async function setAvatarGender(studentId,gender){
  await dbSet(`avatarProfile/${studentId}/gender`, gender);
  toast(gender==='f'?'여캐로 변경':'남캐로 변경');
}
async function buyAvatarItem(studentId,itemId){
  const it=avatarItemById(itemId); if(!it) return; if(ownedAvatarCount(studentId,itemId)>0) return toast('이미 보유 중입니다.'); const price=cosmeticPrice(it); if(!requireCash(studentId,price)) return;
  if(!confirmPurchaseMessage(`${it.name} 구매`, price)) return;
  await dbSet(`avatarCloset/${studentId}/${itemId}`,1);
  await addLedger('아바타구매',`${studentName(studentId)} ${it.name} 구매`,[{account:studentId,delta:-price},{account:CENTRAL,delta:price}],{itemType:'avatar',itemId});
  toast('아바타 구매 완료');
}
buyAvatarItem = async function(studentId,itemId){
  const it=avatarItemById(itemId);
  if(!it) return;
  if(isAvatarHidden(itemId)) return toast("현재 상점에서 숨겨진 아바타입니다.");
  if(ownedAvatarCount(studentId,itemId)>0) return toast("이미 보유 중입니다.");
  const price=cosmeticPrice(it);
  if(!requireCash(studentId,price)) return;
  if(!confirmPurchaseMessage(`${it.name} 구매`, price)) return;
  const creator=avatarCreatorId(it);
  const royalty=avatarCreatorRoyalty(price,it,studentId);
  const centralShare=Math.max(0,price-royalty);
  const lines=[{account:studentId,delta:-price}];
  if(royalty>0) lines.push({account:creator,delta:royalty});
  lines.push({account:CENTRAL,delta:centralShare});
  await dbSet(`avatarCloset/${studentId}/${itemId}`,1);
  await addLedger("아바타구매",`${studentName(studentId)} ${it.name} 구매`,lines,{itemType:"avatar",itemId,creatorId:creator||"",creatorRoyalty:royalty,creatorRoyaltyRate:avatarCreatorRate()});
  toast(royalty>0 ? `아바타 구매 완료 · 제작자 ${studentName(creator)}에게 ${won(royalty)} 지급` : "아바타 구매 완료");
}

async function equipAvatarItem(studentId,itemId){
  const it=avatarItemById(itemId); if(!it) return; if(ownedAvatarCount(studentId,itemId)<=0) return toast('먼저 구매하세요.');
  await dbSet(`avatarState/${studentId}/avatar`,itemId); toast('아바타 장착 완료');
}
async function buyRoomTemplate(studentId,itemId){
  const it=roomTemplateById(itemId); if(!it) return toast("미니룸을 찾을 수 없습니다.");
  if(ownedRoomTemplateCount(studentId,itemId)>0) return toast("이미 보유 중입니다.");
  const price=cosmeticPrice(it); if(!requireCash(studentId,price)) return;
  if(!confirmPurchaseMessage(`${it.name} 구매`, price)) return;
  await dbSet(`roomTemplateCloset/${studentId}/${itemId}`,1);
  await addLedger("미니룸구매",`${studentName(studentId)} ${it.name} 구매`,[{account:studentId,delta:-price},{account:CENTRAL,delta:price}],{itemType:"miniroom",itemId});
  toast("미니룸 구매 완료");
}
async function equipRoomTemplate(studentId,itemId){
  const it=roomTemplateById(itemId); if(!it) return toast("미니룸을 찾을 수 없습니다.");
  if(ownedRoomTemplateCount(studentId,itemId)<=0) return toast("먼저 구매하세요.");
  await dbSet(`roomTemplateState/${studentId}/selected`,itemId);
  toast("미니룸 적용 완료");
}
async function buyRoomItem(studentId,itemId){
  const it=roomItemById(itemId); if(!it) return toast("인테리어 아이템을 찾을 수 없습니다.");
  if(ownedRoomCount(studentId,itemId)>0) return toast("이미 보유 중입니다.");
  const price=cosmeticPrice(it); if(!requireCash(studentId,price)) return;
  if(!confirmPurchaseMessage(`${it.name} 구매`, price)) return;
  await dbSet(`roomCloset/${studentId}/${itemId}`,1);
  await addLedger("미니룸가구구매",`${studentName(studentId)} ${it.name} 구매`,[{account:studentId,delta:-price},{account:CENTRAL,delta:price}],{itemType:"room",itemId});
  if(it.type==="wallpaper") await dbSet(`roomState/${studentId}/wallpaper`,itemId);
  else if(it.type==="floor") await dbSet(`roomState/${studentId}/floor`,itemId);
  else await dbSet(`roomState/${studentId}/placed/${itemId}`,true);
  toast("미니룸 아이템 구매 완료");
}
async function toggleRoomItem(studentId,itemId){
  const it=roomItemById(itemId); if(!it) return toast("인테리어 아이템을 찾을 수 없습니다.");
  if(ownedRoomCount(studentId,itemId)<=0) return toast("먼저 구매하세요.");
  const st=roomStateOf(studentId);
  if(it.type==="wallpaper"){
    await dbSet(`roomState/${studentId}/wallpaper`,itemId);
    return toast("벽지 적용 완료");
  }
  if(it.type==="floor"){
    await dbSet(`roomState/${studentId}/floor`,itemId);
    return toast("바닥 적용 완료");
  }
  if(obj(st.placed)[itemId]){
    await dbRemove(`roomState/${studentId}/placed/${itemId}`);
    toast("가구를 치웠습니다");
  }else{
    await dbSet(`roomState/${studentId}/placed/${itemId}`,true);
    toast("가구 배치 완료");
  }
}


function historyTableHtml(){
  const rows=arr(data.history).filter(Boolean).sort((a,b)=>(b.iso||"").localeCompare(a.iso||"")).slice(0,30);
  if(!rows.length) return `<p class="small">저장된 가격 기록이 없습니다.</p>`;
  return `<div class="scroll"><table><thead><tr><th>날짜</th><th>기록</th><th>상품</th><th>티켓</th><th>삭제</th></tr></thead><tbody>${rows.map(h=>{
    const productNames=Object.entries(obj(h.products)).map(([pid,v])=>`${product(pid)?.name||pid}: ${won(n(obj(v).price))}`).join(" / ");
    const ticketNames=Object.entries(obj(h.tickets)).map(([tid,v])=>`${ticketMeta[tid]?.name||tid}: 기준 ${won(n(obj(v).base))}, 구매 ${won(n(obj(v).buy))}, 판매 ${won(n(obj(v).sell))}`).join(" / ");
    return `<tr><td>${(h.iso||"").slice(0,10)}<br><span class="small">${h.at||""}</span></td><td>${h.manual?'수동':'자동'}</td><td>${productNames||"-"}</td><td>${ticketNames||"-"}</td><td><button class="danger" onclick="deleteHistory('${h.id}')">삭제</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function manualHistoryBase(date){
  const d=date || today();
  return {id:"h_manual_"+d+"_"+Date.now().toString(36),at:d+" 수동",iso:d+"T12:00:00.000Z",previousIncome:n(data.previousIncome),todayIncome:todayY(),economyStats:{...currentEconomyStats(d),date:d},tickets:{},products:{},manual:true};
}

window.addIncomeBasedPriceHistory = async function(){
  const date=document.getElementById("incomePriceDate")?.value || today();
  const economyIndex=money(document.getElementById("incomePriceValue")?.value);
  if(economyIndex<0) return toast("경제지수를 확인하세요.");
  const snap=manualHistoryBase(date);
  snap.economyStats={...snap.economyStats,totalHoldings:economyIndex};
  snap.source="economyIndex";
  arr(data.products).forEach(p=>{
    const price=money(productPriceAtEconomyIndex(p,economyIndex));
    snap.products[p.id]={price,publicPrice:publicPriceAtEconomyIndex(p,economyIndex)};
  });
  await dbSet("history/"+snap.id,snap);
  toast("경제지수 기준 가격 기록 추가 완료");
}
function marketListingId(){return "m_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6)}
function nextIndustryAction(studentId,action){
  const current=industryActionState(studentId);
  return {action,count:current?.action===action?n(current.count)+1:1,updatedAt:new Date().toISOString()};
}
function industryActionUpdates(studentId,action){
  return {[`industryDailyActions/${today()}/${studentId}`]:nextIndustryAction(studentId,action)};
}
window.setMarketCategory = function(value){
  marketCategory=value || "전체";
  marketPage=1;
  localStorage.setItem("marketCategory",marketCategory);
  localStorage.setItem("marketPage",String(marketPage));
  refreshMarketLists();
}
window.setMarketSearch = function(value){
  marketSearch=value || "";
  marketPage=1;
  localStorage.setItem("marketSearch",marketSearch);
  localStorage.setItem("marketPage",String(marketPage));
  refreshMarketLists();
}
window.setMarketSort = function(value){
  marketSort=value || "boost";
  marketPage=1;
  localStorage.setItem("marketSort",marketSort);
  localStorage.setItem("marketPage",String(marketPage));
  refreshMarketLists();
}
window.setMarketPage = function(page){
  marketPage=Math.max(1,Number(page)||1);
  localStorage.setItem("marketPage",String(marketPage));
  refreshMarketLists();
}
function refreshMarketLists(){
  if(studentTab!=="market" || !selectedStudent) return;
  const open=marketListings().filter(marketListingMatches);
  const mine=open.filter(l=>l.sellerId===selectedStudent);
  const others=open;
  const othersEl=document.getElementById("marketOthersList");
  const mineEl=document.getElementById("marketMineList");
  if(othersEl) othersEl.innerHTML=marketGroupedListingsHtml(others,selectedStudent);
  if(mineEl) mineEl.innerHTML=mine.map(l=>marketListingCard(l,selectedStudent)).join("") || `<p class="small">판매 중인 물건이 없습니다.</p>`;
}
function listingById(id){
  return obj(data.marketListings)[id] || marketListings().find(l=>l.id===id);
}
window.toggleMarketPreview = async function(id){
  const l=listingById(id);
  if(!l || l.sellerId!==selectedStudent) return toast("내 판매글만 대표 미리보기를 설정할 수 있습니다.");
  const willOn=!l.preview;
  const mine=marketListings().filter(x=>x.sellerId===selectedStudent && x.preview && x.id!==id);
  if(willOn && mine.length>=4) return toast("대표 미리보기는 최대 4개까지만 선택할 수 있습니다.");
  await dbSet(`marketListings/${id}/preview`, willOn);
  toast(willOn ? "대표 미리보기로 선택했습니다." : "대표 미리보기에서 해제했습니다.");
}
window.showSellerMarketList = function(sellerId){
  if(!sellerId) return;
  const title=document.getElementById("detailTitle");
  const sub=document.getElementById("detailSub");
  const body=document.getElementById("detailBody");
  if(title) title.textContent=`${studentName(sellerId)} 판매 목록`;
  if(sub) sub.textContent="판매자를 눌러 열린 전체 판매 목록입니다. 카테고리/검색 필터가 있으면 그 조건이 반영됩니다.";
  if(body) body.innerHTML=marketSellerPopupHtml(sellerId,selectedStudent);
  document.getElementById("detailModal")?.classList.remove("hidden");
}
window.selectIndustryRole = async function(roleId){
  const studentId=selectedStudent;
  const role=industryRole(roleId);
  if(!studentId || !role) return toast("산업 직업을 확인하세요.");
  const current=industryRoleState(studentId);
  if(current?.role===roleId) return toast("이미 선택한 산업 직업입니다.");
  const fee=money(role.fee || 10);
  const changing=!!current?.role;
  if(changing && !confirm("산업 직업을 변경하면 보유한 재료/완제품 재고가 모두 사라집니다. 10열매를 내고 변경하시겠습니까?")) return;
  if(!requireCash(studentId,fee)) return;
  const updates={};
  updates[`industryRoles/${studentId}`]={role:role.id,roleName:role.name,selectedAt:today()};
  if(changing) updates[`industryInventories/${studentId}`]=null;
  await dbUpdate("",updates);
  await addLedger(changing?"산업직업변경":"산업직업선택",`${studentName(studentId)} 산업 직업 ${role.name} ${changing?"변경":"선택"}`,[{account:studentId,delta:-fee},{account:CENTRAL,delta:fee}],{role:role.id,roleName:role.name,fee});
  toast(`${role.name} 선택 완료`);
}
window.produceIndustryMaterial = async function(materialId){
  const studentId=selectedStudent;
  const item=industryMaterial(materialId);
  const role=industryRoleState(studentId)?.role;
  if(!studentId || !item) return toast("재료를 확인하세요.");
  if(!role) return toast("산업 직업을 먼저 선택하세요.");
  if(role!==item.role) return toast(`${industryRole(item.role)?.name||"해당 직업"}만 생산할 수 있습니다.`);
  if(industryActionBlocked(studentId,"materialProduction")) return toast("오늘은 이미 완제품 제작을 선택해서 재료 생산을 할 수 없습니다.");
  const cost=money(item.productionCost);
  if(!confirm(`${item.name} 1개를 생산비 ${won(cost)}로 생산하시겠습니까?`)) return;
  if(!requireCash(studentId,cost)) return;
  const updates={...industryActionUpdates(studentId,"materialProduction")};
  updates[`industryInventories/${studentId}/${item.id}`]=industryQty(studentId,item.id)+1;
  await dbUpdate("",updates);
  await addLedger("재료생산",`${studentName(studentId)} ${item.name} 1개 생산`,[{account:studentId,delta:-cost},{account:CENTRAL,delta:cost}],{itemId:item.id,category:item.category,productionCost:cost});
  toast(`${item.name} 생산 완료`);
}
window.manufactureIndustryProduct = async function(productId){
  const studentId=selectedStudent;
  const item=industryProduct(productId);
  if(!studentId || !item) return toast("완제품을 확인하세요.");
  if(industryActionBlocked(studentId,"productManufacturing")) return toast("오늘은 이미 재료 생산을 선택해서 완제품 제작을 할 수 없습니다.");
  const missing=Object.entries(obj(item.materials)).filter(([mid,qty])=>industryQty(studentId,mid)<n(qty));
  if(missing.length) return toast("필요 재료가 부족합니다.");
  const cost=money(item.manufactureCost);
  if(!confirm(`${item.name} 1개를 제작하시겠습니까?\n필요 재료: ${industryRecipeText(item)} / 제조비 ${won(cost)}`)) return;
  if(!requireCash(studentId,cost)) return;
  const updates={...industryActionUpdates(studentId,"productManufacturing")};
  Object.entries(obj(item.materials)).forEach(([mid,qty])=>{
    updates[`industryInventories/${studentId}/${mid}`]=industryQty(studentId,mid)-n(qty);
  });
  updates[`industryInventories/${studentId}/${item.id}`]=industryQty(studentId,item.id)+1;
  await dbUpdate("",updates);
  await addLedger("제품제작",`${studentName(studentId)} ${item.name} 1개 제작`,[{account:studentId,delta:-cost},{account:CENTRAL,delta:cost}],{itemId:item.id,materials:item.materials,manufactureCost:cost});
  toast(`${item.name} 제작 완료`);
}
window.resetStudentIndustryRole = async function(studentId){
  if(!student(studentId)) return toast("학생을 확인하세요.");
  if(!confirm(`${studentName(studentId)}의 산업 직업을 초기화할까요?`)) return;
  await dbRemove(`industryRoles/${studentId}`);
  toast("산업 직업 초기화 완료");
}
window.resetStudentIndustryInventory = async function(studentId){
  if(!student(studentId)) return toast("학생을 확인하세요.");
  if(!confirm(`${studentName(studentId)}의 산업 재고를 모두 초기화할까요?`)) return;
  await dbRemove(`industryInventories/${studentId}`);
  toast("산업 재고 초기화 완료");
}
window.resetAllIndustryInventories = async function(){
  if(!confirm("전체 학생의 산업 재고를 모두 초기화할까요? 일반 상품 재고와 잔고는 건드리지 않습니다.")) return;
  await dbRemove("industryInventories");
  toast("전체 산업 재고 초기화 완료");
}
window.resetTodayIndustryActions = async function(){
  if(!confirm("오늘 산업 행동 잠금을 모두 초기화할까요?")) return;
  await dbUpdate("",{[`industryDailyActions/${today()}`]:null,industryActionLocks:null});
  toast("오늘 산업 행동 잠금 초기화 완료");
}
window.createProductListing = async function(){
  const seller=selectedStudent;
  const pid=document.getElementById("marketProductId")?.value;
  const qty=Math.max(1,n(document.getElementById("marketProductQty")?.value));
  const price=money(document.getElementById("marketProductPrice")?.value);
  if(!seller||!pid||!product(pid)||price<=0) return toast("상품과 가격을 확인하세요.");
  const current=n(obj(obj(data.inventories)[seller])[pid]);
  if(current<qty) return toast("보유 수량이 부족합니다.");
  const id=marketListingId();
  const listing={id,status:"open",kind:"product",category:"기존상품",sellerId:seller,productId:pid,name:product(pid).name,qty,price,createdAt:new Date().toISOString()};
  const updates={};
  updates[`marketListings/${id}`]=listing;
  updates[`inventories/${seller}/${pid}`]=current-qty;
  await dbUpdate("",updates);
  hideStudentDetail();
  toast("상품 판매 등록 완료");
}
window.createTicketListing = async function(){
  const seller=selectedStudent;
  const tid=document.getElementById("marketTicketId")?.value;
  const price=money(document.getElementById("marketTicketPrice")?.value);
  if(!seller||!tid||!ticketMeta[tid]||price<=0) return toast("티켓과 가격을 확인하세요.");
  const current=n(obj(obj(data.ticketHoldings)[seller])[tid]);
  if(current<=0) return toast("보유 티켓이 없습니다.");
  const id=marketListingId();
  const listing={id,status:"open",kind:"ticket",category:"티켓",sellerId:seller,ticketId:tid,name:ticketMeta[tid].name,qty:1,price,createdAt:new Date().toISOString()};
  const updates={};
  updates[`marketListings/${id}`]=listing;
  updates[`ticketHoldings/${seller}/${tid}`]=current-1;
  await dbUpdate("",updates);
  hideStudentDetail();
  toast("티켓 판매 등록 완료");
}
window.createCustomListing = async function(){
  const seller=selectedStudent;
  const category=document.getElementById("marketCustomCategory")?.value || "기타물품";
  const name=document.getElementById("marketCustomName")?.value.trim();
  const price=money(document.getElementById("marketCustomPrice")?.value);
  const note=document.getElementById("marketCustomNote")?.value.trim()||"";
  if(!seller||!name||price<=0) return toast("이름과 가격을 확인하세요.");
  const id=marketListingId();
  const listing={id,status:"open",kind:"custom",category,sellerId:seller,name,qty:1,price,note,createdAt:new Date().toISOString()};
  await dbSet("marketListings/"+id,listing);
  hideStudentDetail();
  toast("자유 거래 등록 완료");
}
async function createIndustryListing(kind){
  const seller=selectedStudent;
  const isProduct=kind==="industryProduct";
  const prefix=isProduct?"Product":"Material";
  const itemId=document.getElementById(`marketIndustry${prefix}Id`)?.value;
  const qty=Math.max(1,Math.floor(n(document.getElementById(`marketIndustry${prefix}Qty`)?.value)));
  const price=money(document.getElementById(`marketIndustry${prefix}Price`)?.value);
  const note=document.getElementById(`marketIndustry${prefix}Note`)?.value.trim()||"";
  const item=isProduct ? industryProduct(itemId) : industryMaterial(itemId);
  if(!seller || !item || qty<=0 || price<=0) return toast("물품, 수량, 가격을 확인하세요.");
  if(industryQty(seller,item.id)<qty) return toast("보유 수량이 부족합니다.");
  const id=marketListingId();
  const listing={id,status:"open",kind,category:isProduct?"완제품":item.category,sellerId:seller,itemId:item.id,name:item.name,qty,price,note,createdAt:new Date().toISOString()};
  const updates={};
  updates[`marketListings/${id}`]=listing;
  updates[`industryInventories/${seller}/${item.id}`]=industryQty(seller,item.id)-qty;
  await dbUpdate("",updates);
  hideStudentDetail();
  toast(`${item.name} 판매 등록 완료`);
}
window.createIndustryMaterialListing = async function(){ await createIndustryListing("industryMaterial"); }
window.createIndustryProductListing = async function(){ await createIndustryListing("industryProduct"); }
window.createJobListing = async function(){
  const seller=selectedStudent;
  const jobId=document.getElementById("marketJobId")?.value;
  const price=money(document.getElementById("marketJobPrice")?.value);
  const s=student(seller), j=job(jobId);
  if(!seller||!jobId||!j||price<=0) return toast("직업과 가격을 확인하세요.");
  if(!studentHasJob(s,jobId)) return toast("보유한 직업만 판매할 수 있습니다.");
  if(!confirm(`${j.name} 직업을 ${won(price)}에 판매 등록할까요?\n등록하면 판매 완료 또는 취소 전까지 내 직업에서 빠집니다.`)) return;
  const id=marketListingId();
  const remaining=studentJobIds(s).filter(id=>id!==jobId);
  const listing={id,status:"open",kind:"job",category:"직업",sellerId:seller,jobId,name:j.name,qty:1,price,createdAt:new Date().toISOString()};
  const updates={};
  updates[`marketListings/${id}`]=listing;
  updates[`students/${seller}/jobIds/${jobId}`]=null;
  updates[`students/${seller}/job`]=jobNamesFromIds(remaining);
  if(s.jobId===jobId) updates[`students/${seller}/jobId`]=null;
  await dbUpdate("",updates);
  hideStudentDetail();
  toast("직업 판매 등록 완료");
}
window.cancelMarketListing = async function(id){
  const l=obj(data.marketListings)[id];
  if(!l||l.status!=="open") return toast("이미 처리된 거래입니다.");
  if(l.sellerId!==selectedStudent && mode!=="teacher") return toast("본인 판매글만 취소할 수 있습니다.");
  const updates={};
  if(l.kind==="product"){
    const cur=n(obj(obj(data.inventories)[l.sellerId])[l.productId]);
    updates[`inventories/${l.sellerId}/${l.productId}`]=cur+(n(l.qty)||1);
  }
  if(l.kind==="ticket"){
    const cur=n(obj(obj(data.ticketHoldings)[l.sellerId])[l.ticketId]);
    updates[`ticketHoldings/${l.sellerId}/${l.ticketId}`]=cur+1;
  }
  if(l.kind==="industryMaterial" || l.kind==="industryProduct"){
    const cur=industryQty(l.sellerId,l.itemId);
    updates[`industryInventories/${l.sellerId}/${l.itemId}`]=cur+(n(l.qty)||1);
  }
  if(l.kind==="job"){
    const s=student(l.sellerId);
    const ids=studentJobIds(s);
    if(!ids.includes(l.jobId)) ids.push(l.jobId);
    updates[`students/${l.sellerId}/jobIds/${l.jobId}`]=true;
    updates[`students/${l.sellerId}/job`]=jobNamesFromIds(ids);
  }
  updates[`marketListings/${id}/status`]="cancelled";
  updates[`marketListings/${id}/cancelledAt`]=new Date().toISOString();
  await dbUpdate("",updates);
  toast("판매 취소 완료");
}
window.buyMarketListing = async function(id){
  const buyer=selectedStudent;
  const l=obj(data.marketListings)[id];
  if(!buyer||!l||l.status!=="open") return toast("구매할 수 없는 물건입니다.");
  if(l.sellerId===buyer) return toast("내 물건은 구매할 수 없습니다.");
  const price=money(l.price), tx=tax(price), total=price+tx;
  if(price<=0||!requireCash(buyer,total)) return;
  if(!confirmPurchaseMessage(`${marketListingName(l)} 구매`, total)) return;
  const updates={};
  if(l.kind==="product"){
    const cur=n(obj(obj(data.inventories)[buyer])[l.productId]);
    updates[`inventories/${buyer}/${l.productId}`]=cur+(n(l.qty)||1);
  }
  if(l.kind==="ticket"){
    const cur=n(obj(obj(data.ticketHoldings)[buyer])[l.ticketId]);
    updates[`ticketHoldings/${buyer}/${l.ticketId}`]=cur+1;
  }
  if(l.kind==="industryMaterial" || l.kind==="industryProduct"){
    const cur=industryQty(buyer,l.itemId);
    updates[`industryInventories/${buyer}/${l.itemId}`]=cur+(n(l.qty)||1);
  }
  if(l.kind==="job"){
    const bs=student(buyer);
    if(studentHasJob(bs,l.jobId)) return toast("이미 보유한 직업입니다.");
    const ids=[...studentJobIds(bs),l.jobId].filter((id,i,a)=>a.indexOf(id)===i);
    updates[`students/${buyer}/jobIds/${l.jobId}`]=true;
    updates[`students/${buyer}/job`]=jobNamesFromIds(ids);
  }
  updates[`marketListings/${id}/status`]="sold";
  updates[`marketListings/${id}/buyerId`]=buyer;
  updates[`marketListings/${id}/soldAt`]=new Date().toISOString();
  await dbUpdate("",updates);
  await addLedger("시장거래",`${studentName(buyer)} → ${studentName(l.sellerId)} ${marketListingName(l)} 구매`,[{account:buyer,delta:-total},{account:l.sellerId,delta:price},{account:CENTRAL,delta:tx}],{listingId:id,kind:l.kind,tax:tx});
  toast("거래 완료");
}



function corporationStudentHtml(studentId){
  const holdings=studentCorporationShares(studentId);
  const total=holdings.reduce((sum,h)=>sum+n(h.value),0);
  return `<div class="section corporationStudentTop">
    <div class="head"><div><h2>법인 업무</h2><div class="sub">법인 직업을 가진 계정만 볼 수 있는 법인 운영 화면입니다.</div></div><div>${currentAssetPill(studentId)}</div></div>
    <div class="grid g3">
      <div class="tabletStat purple"><span>법인 주식 공식가치</span><b>${won(total)}</b><em>벌금 산정에는 공식가 기준</em></div>
      <div class="tabletStat blue"><span>보유 법인 수</span><b>${holdings.length}개</b><em>주식 1장 = 지분 1%</em></div>
      <div class="tabletStat orange"><span>미납 벌금</span><b>${won(unpaidFinesForStudent(studentId).reduce((a,f)=>a+remainingFineAmount(f),0))}</b><em>주식 판매 시 우선 납부</em></div>
    </div>
    <p class="small">벌금 계산에는 시장에서 사고파는 가격이 아니라 법인의 공식 주식 가격이 사용됩니다. 벌금은 경고 2회 시점에 확정되므로 나중에 주식을 팔아도 이미 나온 벌금은 줄어들지 않습니다.</p>
  </div>
  <div class="section"><div class="head"><div><h2>내 보유 주식</h2><div class="sub">보유 주식, 지분율, 공식가치를 확인하고 매도 등록할 수 있습니다.</div></div></div>${studentCorporationHoldingsHtml(studentId)}</div>
  <div class="section"><div class="head"><div><h2>법인 주식 시장</h2><div class="sub">친구들이 올린 법인 주식 매물을 구매합니다.</div></div></div>${shareMarketHtml(studentId)}</div>
  <div class="section"><div class="head"><div><h2>전체 법인 정보</h2><div class="sub">대표, 공식 주가, 주주 구성을 확인합니다.</div></div></div><div class="corporationCardGrid">${corporations().map(c=>corporationDetailCardHtml(c,studentId,false)).join("") || `<p class="small">등록된 법인이 없습니다.</p>`}</div></div>`;
}
function studentCorporationHoldingsHtml(studentId){
  const rows=studentCorporationShares(studentId);
  if(!rows.length) return `<p class="small">보유한 법인 주식이 없습니다.</p>`;
  return `<div class="corporationHoldingGrid">${rows.map(({corporation:c,shares,value})=>`
    <div class="corpHoldingCard">
      <div class="head"><div><h3>${c.name}</h3><div class="sub">${c.representativeStudentId===studentId?"대표":"주주"}</div></div><span class="pill ${c.representativeStudentId===studentId?'green':'blue'}">${shares}장</span></div>
      <div class="corpShareBig">${shares}%</div>
      <p>공식 주가 ${won(c.officialSharePrice)} · 내 공식가치 <b>${won(value)}</b></p>
      <div class="field"><label>매도 수량</label><input id="shareSellQty_${c.id}" type="number" min="1" max="${availableCorporationShares(studentId,c.id)}" value="1"></div>
      <div class="field"><label>1장당 판매가</label><input id="shareSellPrice_${c.id}" type="number" value="${Math.max(1,c.officialSharePrice)}"></div>
      <button class="orange" onclick="createShareSellOrder('${c.id}')">주식 매도 등록</button>
      <div class="small">판매 가능 ${availableCorporationShares(studentId,c.id)}장 · 이미 매도 등록한 수량은 제외됩니다.</div>
    </div>`).join("")}</div>`;
}
function shareMarketHtml(viewerId,corpId=""){
  const list=openShareSellOrders().filter(o=>!corpId || o.corporationId===corpId);
  if(!list.length) return `<p class="small">현재 매도 중인 법인 주식이 없습니다.</p>`;
  return `<div class="scroll"><table class="shareMarketTable"><thead><tr><th>법인</th><th>판매자</th><th class="num">수량</th><th class="num">1장 가격</th><th class="num">총액</th><th>상태</th><th>처리</th></tr></thead><tbody>${list.map(o=>{
    const c=corporationById(o.corporationId);
    const mine=o.sellerStudentId===viewerId;
    return `<tr><td><b>${c?.name||o.corporationId}</b><div class="small">공식가 ${won(c?.officialSharePrice||0)}</div></td><td>${studentName(o.sellerStudentId)}</td><td class="num">${n(o.shareAmount)}장</td><td class="num">${won(o.pricePerShare)}</td><td class="num"><b>${won(o.totalPrice)}</b></td><td>${unpaidFinesForStudent(o.sellerStudentId).length?`<span class="pill orange">벌금 우선납부</span>`:`<span class="pill blue">판매중</span>`}</td><td>${mine?`<button class="danger compactBtn" onclick="cancelShareSellOrder('${o.id}')">취소</button>`:`<button class="green compactBtn" onclick="buyShareSellOrder('${o.id}')">구매</button>`}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function corporationDetailCardHtml(c,viewerId="",teacher=false){
  const rows=Object.entries(c.shareholders).sort((a,b)=>n(b[1])-n(a[1]) || studentName(a[0]).localeCompare(studentName(b[0]),"ko"));
  const warn=c.shareTotal!==100?`<span class="pill red">주식합계 ${c.shareTotal}장 확인 필요</span>`:`<span class="pill green">100장</span>`;
  return `<div class="corpDetailCard">
    <div class="head"><div><h3>${c.name}</h3><div class="sub">대표 ${studentName(c.representativeStudentId)}</div></div>${warn}</div>
    <div class="grid g3 miniCorpStats">
      <div><span>순자산</span><b>${won(c.netAssetValue)}</b></div>
      <div><span>공식 주가</span><b>${won(c.officialSharePrice)}</b></div>
      <div><span>현금</span><b>${won(corporationCashBalance(c))}</b></div>
    </div>
    <div class="scroll"><table><thead><tr><th>주주</th><th class="num">주식</th><th class="num">지분</th><th class="num">공식가치</th></tr></thead><tbody>${rows.map(([sid,shares])=>`<tr><td>${studentName(sid)}${sid===c.representativeStudentId?` <span class="pill green">대표</span>`:""}</td><td class="num">${shares}장</td><td class="num">${shares}%</td><td class="num">${won(n(shares)*c.officialSharePrice)}</td></tr>`).join("") || `<tr><td colspan="4">주주 없음</td></tr>`}</tbody></table></div>
    ${shareMarketHtml(viewerId,c.id)}
    ${teacher?`<div class="toolbar"><button onclick="initializeCorporationShares('${c.id}')">100장 균등 배분</button><button class="blue" onclick="recalculateCorporationValue('${c.id}')">공식가 재계산</button><button class="orange" onclick="editCorporationShares('${c.id}')">주식 수동 수정</button><button class="green" onclick="setCorporationRepresentativeManual('${c.id}')">대표 수동 지정</button></div>`:""}
  </div>`;
}
function corporationOptions(){
  const rows=corporations();
  if(!rows.length) return `<option value="">법인 없음</option>`;
  return rows.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
}
function multiStudentOptions(){return students().map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
function multiStudentCheckboxes(id,excludeId=""){
  const rows=students().filter(s=>s.id!==excludeId);
  if(!rows.length) return `<p class="small">선택할 학생이 없습니다.</p>`;
  return `<div class="memberPicker" id="${id}Picker">${rows.map(s=>`<label class="memberPick"><input type="checkbox" data-member-picker="${id}" value="${s.id}"><span>${s.name}</span><em>${s.id}</em></label>`).join("")}</div><div class="miniToolbar"><button type="button" class="compactBtn" onclick="setMemberPicker('${id}',true)">전체 선택</button><button type="button" class="compactBtn" onclick="setMemberPicker('${id}',false)">전체 해제</button></div>`;
}
window.setMemberPicker=function(id,checked){
  document.querySelectorAll(`input[data-member-picker="${id}"]`).forEach(cb=>{cb.checked=!!checked;});
}
function memberPickerValues(id){
  return Array.from(document.querySelectorAll(`input[data-member-picker="${id}"]:checked`)).map(o=>o.value).filter(Boolean);
}
function corporationAccountStudents(){return students().filter(s=>isCorporationAssignedStudent(s.id))}
function corporationAccountStudentOptions(){
  const rows=corporationAccountStudents();
  if(!rows.length) return `<option value="">직업이 법인인 학생 계정 없음</option>`;
  return rows.map(s=>`<option value="${s.id}">${s.name} (${s.id})${corporationRaw(s.id)?" · 전환됨":""}</option>`).join("");
}
function corporationAccountConversionSummaryHtml(){
  const rows=corporationAccountStudents();
  if(!rows.length) return `<p class="small">직업이 법인인 학생 계정이 없습니다. 학생 직업에 ‘법인’ 또는 법인 직업을 먼저 배정하세요.</p>`;
  return `<div class="scroll miniScroll"><table><thead><tr><th>법인 계정</th><th>상태</th><th class="num">계좌 잔고</th><th>연결 법인</th></tr></thead><tbody>${rows.map(s=>{
    const c=corporationById(s.id);
    return `<tr><td><b>${s.name}</b><div class="small">${s.id}</div></td><td>${c?`<span class="pill green">전환 완료</span>`:`<span class="pill orange">전환 필요</span>`}</td><td class="num">${won(balanceOf(s.id))}</td><td>${c?`${c.name}<div class="small">대표 ${studentName(c.representativeStudentId)||"미정"} · 공식가 ${won(c.officialSharePrice)}</div>`:`-`}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function membersObjectFromIds(ids){return ids.reduce((o,id)=>{ if(student(id)) o[id]=true; return o; },{})}
function uniqueExistingMemberIds(ids,excludeId=""){return [...new Set(ids.filter(id=>student(id) && id!==excludeId))]}
function corporationShareholdersFromSelectedMembers(memberIds,preferredId=""){
  const ids=uniqueExistingMemberIds(memberIds);
  return distributeShares(ids, preferredId && ids.includes(preferredId) ? preferredId : ids[0]);
}
function corporationAdminTableHtml(){
  const rows=corporations();
  if(!rows.length) return `<p class="small">등록된 법인이 없습니다. 먼저 법인을 만들어 주세요.</p>`;
  return `<div class="corporationCardGrid">${rows.map(c=>corporationDetailCardHtml(c,"",true)).join("")}</div>`;
}
function renderCorporations(){
  const el=document.getElementById("corporations");
  if(!el) return;
  el.innerHTML=`<div class="section"><div class="head"><div><h2>법인·주식 관리</h2><div class="sub">법인 1개는 주식 100장을 가지며, 가장 많은 주식을 가진 학생이 대표입니다.</div></div><span class="pill purple">주식 100장</span></div>
    <div class="grid g3">
      <div class="card"><h3>법인 만들기</h3><div class="field"><label>법인명</label><input id="newCorpName" placeholder="예: 오삼상사"></div><div class="field"><label>법인 계좌 ID 선택</label><input id="newCorpAccountId" placeholder="비워두면 자동 생성"></div><div class="field"><label>창립 구성원</label>${multiStudentCheckboxes("newCorpMembers")}</div><button class="primary" onclick="createCorporation()">법인 생성</button><p class="small">여러 명을 체크하면 구성원에게 주식 100장을 균등 배분합니다. 나누어떨어지지 않는 1장은 첫 구성원에게 배분됩니다.</p></div>
      <div class="card"><h3>기존 법인계정 전환</h3><p class="small">이미 학생으로 등록돼 있고 직업이 ‘법인’인 계정을 실제 법인 데이터로 전환합니다. 기존 잔고는 법인 계좌 잔고로 그대로 사용됩니다.</p><div class="field"><label>전환할 법인 계정</label><select id="convertCorpAccountId">${corporationAccountStudentOptions()}</select></div><div class="field"><label>주식을 나눌 실제 구성원</label>${multiStudentCheckboxes("convertCorpMembers")}</div><button class="orange" onclick="convertCorporationAccountToCorporation()">선택 계정을 법인으로 전환</button><p class="small">여러 명을 체크하면 주식 100장이 선택한 구성원에게 균등 배분됩니다. 3명이면 34/33/33처럼 나뉩니다. 법인 계정 자체가 체크되어도 주주에서는 제외됩니다.</p></div>
      <div class="card"><h3>공식가 재계산</h3><p class="small">법인 현금과 재고/채권/부채 값을 바탕으로 공식 주가를 다시 계산합니다.</p><div class="field"><label>법인</label><select id="corpRecalcId">${corporationOptions()}</select></div><button class="blue" onclick="recalculateCorporationValue(document.getElementById('corpRecalcId').value)">공식가 재계산</button></div>
      <div class="card"><h3>주식 제도 안내</h3><p>주식 1장 = 지분 1%</p><p>대표 = 최다 주식 보유자</p><p>벌금 산정 = 시장가가 아니라 공식 주가 기준</p><p class="small">법인은 벌금을 피하기 위한 숨겨진 지갑이 아니라, 지분으로 평가되는 투자 자산입니다.</p></div>
    </div>
  </div>
  <div class="section"><div class="head"><div><h2>직업이 법인인 학생 계정</h2><div class="sub">기존 공동계좌로 쓰던 학생 계정을 법인 데이터로 전환했는지 확인합니다.</div></div></div>${corporationAccountConversionSummaryHtml()}</div>
  <div class="section"><div class="head"><div><h2>법인 목록</h2><div class="sub">주식 배분, 대표, 공식 주가를 확인합니다.</div></div></div>${corporationAdminTableHtml()}</div>
  <div class="section"><div class="head"><div><h2>주식 매도 주문</h2><div class="sub">현재 열려 있는 법인 주식 매물입니다.</div></div></div>${shareMarketHtml("")}</div>`;
}
function rootBalance(root,id){return Object.values(root?.ledger||{}).reduce((sum,e)=>sum+Object.values(e?.lines||{}).filter(l=>l.account===id).reduce((a,l)=>a+n(l.delta),0),0)}
function rootUnpaidFines(root,studentId){
  return Object.values(root?.fines||{}).filter(f=>f && f.studentId===studentId && !["paid","cancelled"].includes(f.status||"unpaid") && Math.max(0,money(f.remainingAmount ?? (n(f.fineAmount)-n(f.paidAmount))))>0).sort((a,b)=>String(a.dueDate||a.issuedAt||"").localeCompare(String(b.dueDate||b.issuedAt||"")));
}
function rootAvailableShares(root,studentId,corpId){
  const held=n(root?.corporations?.[corpId]?.shareholders?.[studentId]);
  const open=Object.values(root?.shareSellOrders||{}).filter(o=>o && o.status==="open" && o.sellerStudentId===studentId && o.corporationId===corpId).reduce((sum,o)=>sum+n(o.shareAmount),0);
  return Math.max(0,held-open);
}
function rootResolveRepresentative(c,current=""){
  const rows=Object.entries(obj(c?.shareholders)).filter(([,v])=>n(v)>0).sort((a,b)=>n(b[1])-n(a[1]));
  if(!rows.length) return "";
  const max=n(rows[0][1]);
  const leaders=rows.filter(([,v])=>n(v)===max).map(([id])=>id);
  if(current && leaders.includes(current)) return current;
  return leaders.length===1 ? leaders[0] : (current || leaders[0]);
}
function selectedValues(id){
  const picked=memberPickerValues(id);
  if(picked.length) return picked;
  const el=document.getElementById(id);
  if(el?.selectedOptions) return Array.from(el.selectedOptions).map(o=>o.value).filter(Boolean);
  return [];
}


window.createCorporation = async function(){
  const name=String(document.getElementById("newCorpName")?.value||"").trim();
  const members=selectedValues("newCorpMembers");
  const accountInput=String(document.getElementById("newCorpAccountId")?.value||"").trim();
  if(!name) return toast("법인명을 입력하세요.");
  if(!members.length) return toast("창립 구성원을 1명 이상 선택하세요.");
  const id=(accountInput || `corp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`).replace(/[^a-zA-Z0-9_\-가-힣]/g,"_");
  if(corporationRaw(id)) return toast("이미 존재하는 법인 ID입니다.");
  const shareholders=distributeShares(members,members[0]);
  const corp={id,name,totalShares:100,members:members.reduce((o,m)=>{o[m]=true;return o;},{}),shareholders,representativeStudentId:resolveCorporationRepresentative({shareholders},members[0]),cashAccountId:id,cashBalance:0,inventoryValue:0,receivables:0,debt:0,netAssetValue:0,officialSharePrice:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await dbSet(`corporations/${id}`,corp);
  toast("법인 생성 완료");
}
window.convertCorporationAccountToCorporation = async function(){
  const accountId=String(document.getElementById("convertCorpAccountId")?.value||"").trim();
  const members=selectedValues("convertCorpMembers").filter(id=>id!==accountId);
  const account=student(accountId);
  if(!accountId || !account) return toast("전환할 법인 계정을 선택하세요.");
  if(!isCorporationAssignedStudent(accountId)) return toast("직업이 법인인 학생 계정만 전환할 수 있습니다.");
  if(!members.length) return toast("주식을 나눌 실제 구성원을 1명 이상 선택하세요. 법인 계정 자체는 주주에서 제외됩니다.");
  const exists=corporationRaw(accountId);
  const shareholders=distributeShares(members,members[0]);
  const rep=resolveCorporationRepresentative({shareholders},exists?.representativeStudentId || members[0]);
  const cash=balanceOf(accountId);
  const existing=obj(exists);
  const net=money(cash+n(existing.inventoryValue)+n(existing.receivables)-n(existing.debt));
  const corp={
    ...existing,
    id:accountId,
    name:existing.name || account.name || `법인 ${accountId}`,
    totalShares:100,
    members:membersObjectFromIds(members),
    shareholders,
    representativeStudentId:rep,
    cashAccountId:accountId,
    cashBalance:cash,
    inventoryValue:n(existing.inventoryValue),
    receivables:n(existing.receivables),
    debt:n(existing.debt),
    netAssetValue:net,
    officialSharePrice:money(net/100),
    convertedFromStudentAccount:true,
    updatedAt:new Date().toISOString(),
    createdAt:existing.createdAt || new Date().toISOString()
  };
  const msg=exists
    ? `${account.name} 법인 데이터가 이미 있습니다. 선택한 구성원 기준으로 주식 100장을 다시 배분할까요?`
    : `${account.name} 학생 계정을 법인으로 전환할까요?
기존 계좌 잔고 ${won(cash)}가 법인 현금으로 연결됩니다.`;
  if(!confirm(msg)) return;
  const updates={};
  updates[`corporations/${accountId}`]=corp;
  updates[`students/${accountId}/isCorporationAccount`]=true;
  updates[`students/${accountId}/corporationId`]=accountId;
  await dbUpdate("",updates);
  toast(`${account.name} 법인 전환 완료`);
}
window.initializeCorporationShares = async function(corpId){
  const c=corporationById(corpId);
  if(!c) return toast("법인을 찾을 수 없습니다.");
  const members=corporationMembers(c);
  if(!members.length) return toast("구성원이 없어 균등 배분할 수 없습니다.");
  if(!confirm(`${c.name} 주식 100장을 구성원에게 균등 배분할까요? 기존 주식 배분이 바뀝니다.`)) return;
  const shareholders=distributeShares(members,c.representativeStudentId || members[0]);
  const rep=resolveCorporationRepresentative({shareholders},c.representativeStudentId);
  await dbUpdate(`corporations/${corpId}`,{totalShares:100,shareholders,representativeStudentId:rep,updatedAt:new Date().toISOString()});
  toast("주식 100장 배분 완료");
}
window.recalculateCorporationValue = async function(corpId){
  const c=corporationById(corpId);
  if(!c) return toast("법인을 선택하세요.");
  const net=corporationNetAssetValue(c);
  const price=money(net/100);
  await dbUpdate(`corporations/${corpId}`,{netAssetValue:net,officialSharePrice:price,updatedAt:new Date().toISOString()});
  toast(`${c.name} 공식 주가 ${won(price)}로 재계산 완료`);
}
window.editCorporationShares = async function(corpId){
  const c=corporationById(corpId);
  if(!c) return toast("법인을 찾을 수 없습니다.");
  const current=Object.entries(c.shareholders).map(([id,shares])=>`${id}:${shares}`).join("\n");
  const input=prompt(`주식 수를 studentId:수량 형식으로 입력하세요. 총합은 반드시 100장이어야 합니다.\n\n학생ID 참고: ${students().map(s=>`${s.name}=${s.id}`).join(", ")}`,current);
  if(input===null) return;
  const shareholders={};
  input.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const [id,val]=line.split(":").map(x=>String(x||"").trim());
    const shares=money(val);
    if(id && student(id) && shares>0) shareholders[id]=shares;
  });
  const total=Object.values(shareholders).reduce((a,b)=>a+n(b),0);
  if(total!==100) return toast(`주식 합계가 100장이 아닙니다. 현재 ${total}장`);
  const rep=resolveCorporationRepresentative({shareholders},c.representativeStudentId);
  const updates={shareholders,totalShares:100,representativeStudentId:rep,updatedAt:new Date().toISOString()};
  await dbUpdate(`corporations/${corpId}`,updates);
  toast("주식 배분 수정 완료");
}
window.setCorporationRepresentativeManual = async function(corpId){
  const c=corporationById(corpId);
  if(!c) return toast("법인을 찾을 수 없습니다.");
  const input=prompt(`대표로 지정할 학생 ID를 입력하세요.\n${Object.keys(c.shareholders).map(id=>`${studentName(id)}=${id}`).join("\n")}`,c.representativeStudentId||"");
  if(input===null) return;
  const id=String(input).trim();
  if(!student(id) || !n(c.shareholders[id])) return toast("해당 법인의 주주 학생 ID를 입력하세요.");
  await dbUpdate(`corporations/${corpId}`,{representativeStudentId:id,updatedAt:new Date().toISOString()});
  toast("대표 수동 지정 완료");
}
window.createShareSellOrder = async function(corpId){
  const seller=selectedStudent;
  const c=corporationById(corpId);
  const qty=money(document.getElementById(`shareSellQty_${corpId}`)?.value);
  const price=money(document.getElementById(`shareSellPrice_${corpId}`)?.value);
  if(!seller||!c) return toast("법인 정보를 확인하세요.");
  if(qty<=0 || price<=0) return toast("수량과 가격을 확인하세요.");
  let error="";
  const id=`share_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  await runTransaction(rootRef, root=>{
    if(!root) return root;
    const corp=root.corporations?.[corpId];
    if(!corp){error="법인을 찾을 수 없습니다."; return;}
    const available=rootAvailableShares(root,seller,corpId);
    if(available<qty){error=`판매 가능 주식이 부족합니다. 가능 ${available}장`; return;}
    root.shareSellOrders=root.shareSellOrders||{};
    root.shareSellOrders[id]={id,corporationId:corpId,sellerStudentId:seller,shareAmount:qty,pricePerShare:price,totalPrice:money(qty*price),status:"open",createdAt:new Date().toISOString()};
    return root;
  },{applyLocally:false});
  if(error) return toast(error);
  toast("주식 매도 등록 완료");
}
window.cancelShareSellOrder = async function(orderId){
  const order=obj(data.shareSellOrders)[orderId];
  if(!order || order.status!=="open") return toast("취소할 수 없는 주문입니다.");
  if(mode!=="teacher" && order.sellerStudentId!==selectedStudent) return toast("내 주문만 취소할 수 있습니다.");
  await dbUpdate(`shareSellOrders/${orderId}`,{status:"cancelled",cancelledAt:new Date().toISOString()});
  toast("주식 매도 주문 취소 완료");
}
window.buyShareSellOrder = async function(orderId){
  const buyer=selectedStudent;
  const order=obj(data.shareSellOrders)[orderId];
  if(!buyer || !order || order.status!=="open") return toast("구매할 수 없는 주문입니다.");
  if(order.sellerStudentId===buyer) return toast("내 주식은 구매할 수 없습니다.");
  if(!confirm(`${corporationById(order.corporationId)?.name||"법인"} 주식 ${n(order.shareAmount)}장을 ${won(order.totalPrice)}에 구매할까요?`)) return;
  let error="";
  const shareTxId=`sharetx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  const ledgerId=`tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  const repHistoryId=`rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  const txTime=seoulIsoString();
  await runTransaction(rootRef, root=>{
    if(!root) return root;
    const o=root.shareSellOrders?.[orderId];
    if(!o || o.status!=="open"){error="이미 처리된 주문입니다."; return;}
    const corp=root.corporations?.[o.corporationId];
    if(!corp){error="법인을 찾을 수 없습니다."; return;}
    const seller=o.sellerStudentId;
    const qty=money(o.shareAmount), total=money(o.totalPrice || n(o.pricePerShare)*qty);
    if(seller===buyer){error="내 주식은 구매할 수 없습니다."; return;}
    if(rootBalance(root,buyer)<total){error=`잔고 부족: 필요 ${won(total)}`; return;}
    const held=n(corp.shareholders?.[seller]);
    if(held<qty){error="판매자 주식 수가 부족합니다."; return;}
    let finePaid=0;
    let remainingSale=total;
    root.fines=root.fines||{};
    for(const f of rootUnpaidFines(root,seller)){
      if(remainingSale<=0) break;
      const remain=Math.max(0,money(f.remainingAmount ?? (n(f.fineAmount)-n(f.paidAmount))));
      const pay=Math.min(remain,remainingSale);
      if(pay<=0) continue;
      f.paidAmount=money(n(f.paidAmount)+pay);
      f.remainingAmount=money(remain-pay);
      f.status=f.remainingAmount<=0?"paid":"partial";
      if(f.status==="paid") f.paidAt=txTime;
      f.paymentSource="share_sale_offset";
      finePaid+=pay;
      remainingSale-=pay;
    }
    root.corporations=root.corporations||{};
    corp.shareholders=corp.shareholders||{};
    corp.shareholders[seller]=held-qty;
    if(corp.shareholders[seller]<=0) delete corp.shareholders[seller];
    corp.shareholders[buyer]=n(corp.shareholders[buyer])+qty;
    const prevRep=corp.representativeStudentId || "";
    const nextRep=rootResolveRepresentative(corp,prevRep);
    corp.representativeStudentId=nextRep || null;
    corp.updatedAt=txTime;
    if(nextRep && nextRep!==prevRep){
      root.corporateRepresentativeHistory=root.corporateRepresentativeHistory||{};
      root.corporateRepresentativeHistory[repHistoryId]={id:repHistoryId,corporationId:o.corporationId,previousRepresentativeStudentId:prevRep,newRepresentativeStudentId:nextRep,reason:"share_trade",changedAt:txTime};
    }
    o.status="completed";
    o.buyerStudentId=buyer;
    o.completedAt=txTime;
    root.shareTransactions=root.shareTransactions||{};
    root.shareTransactions[shareTxId]={id:shareTxId,corporationId:o.corporationId,sellerStudentId:seller,buyerStudentId:buyer,shareAmount:qty,pricePerShare:n(o.pricePerShare),totalPrice:total,sellerReceivedAmount:money(total-finePaid),finePaidAmountFromSale:finePaid,createdAt:txTime};
    root.ledger=root.ledger||{};
    const lines=[{account:buyer,delta:-total}];
    if(total-finePaid>0) lines.push({account:seller,delta:money(total-finePaid)});
    if(finePaid>0) lines.push({account:CENTRAL,delta:finePaid});
    root.ledger[ledgerId]={id:ledgerId,ts:txTime,day:today(),type:"법인주식거래",desc:`${studentName(buyer)} → ${studentName(seller)} 법인 주식 구매`,lines,meta:{shareTransactionId:shareTxId,orderId,corporationId:o.corporationId,finePaidAmountFromSale:finePaid}};
    return root;
  },{applyLocally:false});
  if(error) return toast(error);
  toast("법인 주식 구매 완료");
}

window.addManualProductPrice = async function(){
  const date=document.getElementById("manualProductDate").value || today();
  const pid=document.getElementById("manualProductId").value;
  const price=money(document.getElementById("manualProductPrice").value);
  if(!pid || price<=0) return toast("상품과 가격을 확인하세요.");
  const snap=manualHistoryBase(date);
  snap.products[pid]={price,publicPrice:price};
  await dbSet("history/"+snap.id,snap);
  toast("상품 가격 기록 추가 완료");
}
window.addManualTicketPrice = async function(){
  const date=document.getElementById("manualTicketDate").value || today();
  const tid=document.getElementById("manualTicketId").value;
  const base=money(document.getElementById("manualTicketBase").value);
  const buy=money(document.getElementById("manualTicketBuy").value);
  const sell=money(document.getElementById("manualTicketSell").value);
  if(!tid || base<=0) return toast("티켓과 기준가를 확인하세요.");
  const snap=manualHistoryBase(date);
  snap.tickets[tid]={base,buy,sell};
  await dbSet("history/"+snap.id,snap);
  toast("티켓 가격 기록 추가 완료");
}
window.deleteHistory = async function(id){
  if(!confirm("이 가격 기록을 삭제할까요?")) return;
  await dbRemove("history/"+id);
  toast("가격 기록 삭제 완료");
}

window.fillManualTicketPrices = function(){
  const k=document.getElementById("manualTicketId")?.value || "classClean";
  if(document.getElementById("manualTicketBase")) document.getElementById("manualTicketBase").value=basePrice(k);
  if(document.getElementById("manualTicketBuy")) document.getElementById("manualTicketBuy").value=ticketBuy(k);
  if(document.getElementById("manualTicketSell")) document.getElementById("manualTicketSell").value=ticketSell(k);
}

window.clearPriceHistory = async function(){
  if(!confirm("가격 기록을 전부 삭제할까요? 상품/티켓 차트 기록이 초기화됩니다.")) return;
  await dbRemove("history");
  toast("가격 기록 전체 삭제 완료");
}

window.applyTodayAsPrevious = async function(){await recordSnapshot(); await dbSet("previousIncome",Math.max(0,currentEconomyStats(today()).issuedIncome)); toast("오늘 경제기록 저장 완료");}
window.recordSnapshot = async function(){
  const snap=currentHistorySnapshot();
  const id="h_"+Date.now().toString(36);
  snap.id=id;
  snap.at=now();
  snap.iso=new Date().toISOString();
  arr(data.products).forEach(p=>snap.products[p.id]={price:money(productPrice(p)),publicPrice:publicPrice(p)});
  await dbUpdate("",{[`history/${id}`]:snap,[`dailyEconomyStats/${today()}`]:snap.economyStats});
  toast("가격·경제 기록 저장 완료");
}

window.repairTickets = async function(){
  const updates={};
  Object.keys(ticketMeta).forEach(k=>{
    const t=ticketData(k);
    updates[`tickets/${k}`]=normalizeTicketState({...t,date:isTopDisplayTicket(k)?today():ticketStoredDate(t)});
  });
  await dbUpdate("",updates);
  toast("티켓 구조 복구 완료");
}


window.saveCosmeticPrices = async function(){
  const updates={};
  allCosmeticItems().forEach(it=>{
    const el=document.getElementById(`cosPrice_${it.id}`);
    if(el) updates[`cosmeticPrices/${it.id}`]=money(el.value);
  });
  await dbUpdate("",updates);
  toast("치장템 가격 저장 완료");
}
window.resetCosmeticPrices = async function(){
  if(!confirm("치장템 가격을 기본값으로 되돌릴까요?")) return;
  await dbRemove("cosmeticPrices");
  toast("기본 가격으로 되돌렸습니다");
}


window.addManagedAvatar = async function(){
  const name=String(document.getElementById("newAvatarName")?.value || "").trim();
  const src=String(document.getElementById("newAvatarSrc")?.value || "").trim();
  const id=avatarManagerId(document.getElementById("newAvatarId")?.value || name);
  const price=money(document.getElementById("newAvatarPrice")?.value || 300);
  const rarity=String(document.getElementById("newAvatarRarity")?.value || "일반").trim() || "일반";
  const creator=document.getElementById("newAvatarCreator")?.value || "";
  if(!name || !src) return toast("아바타 이름과 이미지 경로를 입력하세요.");
  if(price<=0) return toast("가격을 확인하세요.");
  if(avatarItemById(id) && !confirm(`${id} 아바타를 덮어쓸까요?`)) return;
  const item={id,name,type:"avatar",icon:"A",price,rarity,src,order:Date.now()};
  const updates={};
  updates[`avatarItems/${id}`]=item;
  updates[`avatarCreators/${id}`]=creator || null;
  await dbUpdate("",updates);
  toast("아바타 등록 완료");
}
window.saveAvatarCreator = async function(itemId){
  if(!avatarItemById(itemId)) return toast("아바타를 찾을 수 없습니다.");
  const creator=document.getElementById(`avatarCreator_${itemId}`)?.value || "";
  await dbUpdate("",{[`avatarCreators/${itemId}`]:creator || null});
  toast(creator ? `제작자를 ${studentName(creator)}로 저장했습니다.` : "제작자 연결을 해제했습니다.");
}
window.saveAvatarImage = async function(itemId){
  const item=avatarItemById(itemId);
  if(!item) return toast("아바타를 찾을 수 없습니다.");
  const src=String(document.getElementById(`avatarSrc_${itemId}`)?.value || "").trim();
  if(!src) return toast("이미지 URL을 입력하세요.");
  const updated={...item,id:itemId,type:"avatar",src};
  await dbUpdate("",{[`avatarItems/${itemId}`]:updated});
  toast("기존 아바타 이미지가 저장되었습니다.");
}
window.saveAvatarVisibility = async function(itemId,visible){
  if(!avatarItemById(itemId)) return toast("아바타를 찾을 수 없습니다.");
  await dbUpdate("",{[`hiddenAvatars/${itemId}`]:visible ? null : true});
  toast(visible ? "아바타를 상점에 표시합니다." : "아바타를 상점에서 숨겼습니다.");
}
window.setStudentTabVisibility = async function(tabId,visible){
  if(tabId==="dashboard") return toast("대시보드는 기본 화면이라 숨길 수 없습니다.");
  if(!studentTabCatalog().some(tab=>tab.id===tabId)) return toast("학생 메뉴를 찾을 수 없습니다.");
  await dbUpdate("",{[`settings/hiddenStudentTabs/${tabId}`]:visible ? null : true});
  toast(visible ? "학생 화면에 표시합니다." : "학생 화면에서 숨겼습니다.");
}
window.deleteManagedAvatar = async function(itemId){
  if(!isDatabaseAvatar(itemId)) return toast("화면에서 등록한 아바타만 삭제할 수 있습니다.");
  if(!confirm("이 아바타를 삭제할까요? 이미 보유한 기록은 남지만 상점에서는 사라집니다.")) return;
  await dbUpdate("",{[`avatarItems/${itemId}`]:null,[`avatarCreators/${itemId}`]:null,[`cosmeticPrices/${itemId}`]:null});
  toast("아바타 삭제 완료");
}

window.resetEconomyOnly = async function(){
  const msg=`학생 명단, PIN, 직업, 아바타, 미니룸, 치장템 가격은 유지하고 경제 데이터만 초기화할까요?

초기화 대상:
- 거래장부/잔고
- 예금/채권
- 보유 상품/보유 티켓
- 신청 내역
- 시장 매물
- 가격 기록`;
  if(!confirm(msg)) return;
  const updates={
    ledger:null,
    deposits:null,
    bonds:null,
    inventories:null,
    ticketHoldings:null,
    requests:null,
    marketListings:null,
    shareSellOrders:null,
    shareTransactions:null,
    fines:null,
    history:null,
    dailyEconomyStats:null,
    previousIncome:0,
    tickets:structuredClone(defaultData.tickets)
  };
  await dbUpdate("",updates);
  toast("학생 유지 경제 데이터 초기화 완료");
}
window.cleanOldRequests = async function(hours=24){
  const old=oldRequests(hours);
  if(!old.length) return toast("정리할 오래된 신청이 없습니다.");
  if(!confirm(`${hours}시간이 지난 신청 ${old.length}개를 삭제할까요?`)) return;
  const updates={};
  old.forEach(r=>updates[`requests/${r.id}`]=null);
  await dbUpdate("",updates);
  toast("오래된 신청 정리 완료");
}

window.openRankStudent = function(id){
  if(isMobileViewport()){
    activeMobilePage=`peer_${id}`;
    localStorage.setItem("activeMobilePage",activeMobilePage);
    studentTab="more";
    localStorage.setItem("studentTab",studentTab);
    render();
    return;
  }
  showStudentDetail(id);
}
window.editStudentStatusMessage = function(id){
  if(id!==selectedStudent) return toast("내 상태메시지만 수정할 수 있습니다.");
  window.__editingStudentStatusId=id;
  render();
  setTimeout(()=>{
    const input=document.getElementById("studentStatusMessageInput");
    if(input){input.focus(); input.select();}
  },60);
}
window.cancelStudentStatusEdit = function(){
  window.__editingStudentStatusId="";
  render();
}
window.saveStudentStatusMessage = async function(id){
  if(id!==selectedStudent) return toast("내 상태메시지만 수정할 수 있습니다.");
  const input=document.getElementById("studentStatusMessageInput");
  const value=String(input?.value || "").trim().slice(0,30) || "우리 반 함께 성장하는 중";
  await dbSet(`studentStatusMessages/${id}`, value);
  window.__editingStudentStatusId="";
  toast("상태메시지 저장 완료");
}

window.showStudentDetail = function(id){
  const s=student(id); if(!s) return toast("학생을 찾을 수 없습니다.");
  document.getElementById("detailTitle").textContent=`${s.name} 상세 관리`;
  const rank=rankOfStudent(id);
  document.getElementById("detailSub").textContent=`${studentJobName(s)||"직업 없음"} · ${rank==="-"?"개인 순위 제외":`재산 ${rank}위`}`;
  document.getElementById("detailBody").innerHTML=studentDetailHtml(id);
  document.getElementById("detailModal").classList.remove("hidden");
}
window.hideStudentDetail = function(){document.getElementById("detailModal").classList.add("hidden");}
window.detailPayStudent = async function(id){
  const amount=money(document.getElementById("detailAmount")?.value);
  const desc=document.getElementById("detailDesc")?.value || "학생 상세 지급";
  if(amount<=0) return toast("금액을 확인하세요.");
  if(!confirm(`${studentName(id)}에게 ${won(amount)} 지급할까요?`)) return;
  await addLedger("상세지급",desc,[{account:CENTRAL,delta:-amount},{account:id,delta:amount}],{source:"studentDetail"});
  toast("지급 완료");
  showStudentDetail(id);
}
window.detailCollectStudent = async function(id){
  const amount=money(document.getElementById("detailAmount")?.value);
  const desc=document.getElementById("detailDesc")?.value || "학생 상세 회수";
  if(amount<=0) return toast("금액을 확인하세요.");
  if(!requireCash(id,amount)) return;
  if(!confirm(`${studentName(id)}에게서 ${won(amount)} 회수할까요?`)) return;
  await addLedger("상세회수",desc,[{account:id,delta:-amount},{account:CENTRAL,delta:amount}],{source:"studentDetail"});
  toast("회수 완료");
  showStudentDetail(id);
}

window.saveSettings = async function(){
  await dbUpdate("",{previousIncome:n(document.getElementById("setPrev").value),settings:{...data.settings,taxRate:n(document.getElementById("setTax").value)/100,fineRate:n(document.getElementById("setFine").value)/100,fineMin:money(document.getElementById("setFineMin")?.value || 10),fineMax:money(document.getElementById("setFineMax")?.value || 0),bondDays:n(document.getElementById("setBondDays").value),depositRate:n(document.getElementById("setDepositRate").value)/100,avatarCreatorRate:n(document.getElementById("setAvatarCreatorRate")?.value || avatarCreatorPercent())/100}});
  toast("설정 저장 완료");
}
window.resetAll = async function(){if(confirm("정말 전체 데이터를 초기화할까요?")){await set(rootRef,defaultData); toast("초기화 완료");}}
window.forceDefaultData = async function(){await set(rootRef,defaultData); toast("기본 데이터 강제 저장 완료");}

let TEACHER_PASSWORD = "teacher1234";
let teacherUnlocked = sessionStorage.getItem("teacherUnlocked")==="true";

function askTeacherPassword(){
  if(teacherUnlocked){
    setMode("teacher");
    return;
  }
  showTeacherLogin();
}
function showTeacherLogin(){
  document.querySelector(".teacherLoginBack")?.remove();
  const back=document.createElement("div");
  back.className="teacherLoginBack";
  back.innerHTML = `<div class="teacherLoginBox">
    <div class="modalHead">
      <div>
        <h2>교사용 로그인</h2>
        <div class="sub">비밀번호를 입력하면 교사용 화면으로 이동합니다.</div>
      </div>
      <button onclick="closeTeacherLogin()">닫기</button>
    </div>
    <div class="field"><label>비밀번호</label><input id="teacherPasswordInput" type="password" autocomplete="current-password" placeholder="비밀번호"></div>
    <div class="toolbar"><button class="primary" onclick="submitTeacherPassword()">접속</button></div>
  </div>`;
  back.addEventListener("click", e=>{if(e.target===back) closeTeacherLogin();});
  document.body.appendChild(back);
  document.getElementById("teacherPasswordInput")?.addEventListener("keydown", e=>{if(e.key==="Enter") submitTeacherPassword();});
  setTimeout(()=>document.getElementById("teacherPasswordInput")?.focus(),0);
}
function closeTeacherLogin(){
  document.querySelector(".teacherLoginBack")?.remove();
}
function submitTeacherPassword(){
  const pw = document.getElementById("teacherPasswordInput")?.value || "";
  if(pw === TEACHER_PASSWORD){
    teacherUnlocked = true;
    sessionStorage.setItem("teacherUnlocked","true");
    closeTeacherLogin();
    setMode("teacher");
    toast("교사용 모드 진입");
  } else {
    toast("비밀번호가 틀렸습니다.");
    document.getElementById("teacherPasswordInput")?.select();
  }
}

window.askTeacherPassword=askTeacherPassword;
window.switchToStudentMode=switchToStudentMode;
window.switchToTeacherMode=switchToTeacherMode;
window.closeTeacherLogin=closeTeacherLogin;
window.submitTeacherPassword=submitTeacherPassword;
window.showProductChart=showProductChart; window.showTicketChart=showTicketChart; window.showTotalIncomeChart=showTotalIncomeChart; window.hideChart=hideChart;
window.setAvatarGender=setAvatarGender; window.buyAvatarItem=buyAvatarItem; window.equipAvatarItem=equipAvatarItem; window.buyRoomItem=buyRoomItem; window.toggleRoomItem=toggleRoomItem; window.buyRoomTemplate=buyRoomTemplate; window.equipRoomTemplate=equipRoomTemplate;
window.setTab=setTab; window.setMode=setMode; window.toggleFullscreen=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();}

window.toast=toast;

rebuildDerivedState();
render();
