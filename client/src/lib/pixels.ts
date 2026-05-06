export interface PixelConfig {
  facebookPixelId?: string;
  tiktokPixelId?: string;
  snapchatPixelId?: string;
  twitterPixelId?: string;
  gtmId?: string;
}

let _config: PixelConfig = {};
let _initialized = false;
const _loaded = new Set<string>();

function injectInlineScript(id: string, code: string) {
  if (_loaded.has(id) || document.getElementById(id)) return;
  _loaded.add(id);
  const s = document.createElement("script");
  s.id = id;
  s.innerHTML = code;
  document.head.appendChild(s);
}

export function initPixels(config: PixelConfig) {
  _config = { ..._config, ...config };
  if (_initialized) return;
  _initialized = true;

  if (config.facebookPixelId) {
    injectInlineScript(
      "rf-fb-pixel",
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${config.facebookPixelId}');fbq('track','PageView');`,
    );
  }

  if (config.tiktokPixelId) {
    injectInlineScript(
      "rf-ttq-pixel",
      `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
var s=document.createElement("script");s.type="text/javascript";s.async=!0;s.src=r+"?sdkid="+e+"&lib="+t;
var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(s,a)};
ttq.load('${config.tiktokPixelId}');ttq.page();}(window,document,'ttq');`,
    );
  }

  if (config.snapchatPixelId) {
    injectInlineScript(
      "rf-snap-pixel",
      `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
a.queue=[];var s='script',r=t.createElement(s);r.async=!0;
r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);
})(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init','${config.snapchatPixelId}',{'user_email':''});snaptr('track','PAGE_VIEW');`,
    );
  }

  if (config.twitterPixelId) {
    injectInlineScript(
      "rf-twq-pixel",
      `!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):
s.queue.push(arguments)},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,
u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],
a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${config.twitterPixelId}');`,
    );
  }

  if (config.gtmId) {
    injectInlineScript(
      "rf-gtm",
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtmId}');`,
    );
  }
}

export interface PixelEventData {
  value?: number;
  currency?: string;
  contentId?: string;
  contentName?: string;
  contentCategory?: string;
  numItems?: number;
  orderId?: string;
  contents?: Array<{ id: string; quantity: number; price?: number }>;
}

type PixelEvent = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

const FB_EVENTS: Record<PixelEvent, string> = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
};
const TTQ_EVENTS: Record<PixelEvent, string> = {
  PageView: "Browse",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "CompletePayment",
};
const SNAP_EVENTS: Record<PixelEvent, string> = {
  PageView: "PAGE_VIEW",
  ViewContent: "VIEW_CONTENT",
  AddToCart: "ADD_CART",
  InitiateCheckout: "START_CHECKOUT",
  Purchase: "PURCHASE",
};
const TWQ_EVENTS: Record<PixelEvent, string> = {
  PageView: "PageView",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
};

export function trackPixelEvent(event: PixelEvent, data: PixelEventData = {}) {
  const currency = data.currency || "SAR";
  const value = data.value ?? 0;
  const w = window as any;

  try {
    if (_config.facebookPixelId && w.fbq) {
      const d: any = { currency, value };
      if (data.contentId) d.content_ids = [data.contentId];
      if (data.contentName) d.content_name = data.contentName;
      if (data.contentCategory) d.content_category = data.contentCategory;
      if (data.numItems) d.num_items = data.numItems;
      if (data.orderId) d.order_id = data.orderId;
      if (data.contents) d.contents = data.contents.map(c => ({ id: c.id, quantity: c.quantity, item_price: c.price }));
      w.fbq("track", FB_EVENTS[event], d);
    }
  } catch {}

  try {
    if (_config.tiktokPixelId && w.ttq) {
      const d: any = { value, currency };
      if (data.contentId) d.content_id = data.contentId;
      if (data.contentName) d.content_name = data.contentName;
      if (data.contents) d.contents = data.contents;
      w.ttq.track(TTQ_EVENTS[event], d);
    }
  } catch {}

  try {
    if (_config.snapchatPixelId && w.snaptr) {
      const d: any = { currency, price: value };
      if (data.contentId) d.item_ids = [data.contentId];
      if (data.orderId) d.transaction_id = data.orderId;
      if (data.numItems) d.number_items = data.numItems;
      w.snaptr("track", SNAP_EVENTS[event], d);
    }
  } catch {}

  try {
    if (_config.twitterPixelId && w.twq) {
      const d: any = { value, currency };
      if (data.orderId) d.order_id = data.orderId;
      if (data.numItems) d.num_items = data.numItems;
      w.twq("event", TWQ_EVENTS[event], d);
    }
  } catch {}

  try {
    if (_config.gtmId && w.dataLayer) {
      w.dataLayer.push({ event, ecommerce: { currency, value, ...data } });
    }
  } catch {}

  logPixelEvent(event, data);
}

const PIXEL_LOG_KEY = "rf_pixel_log";
const MAX_LOG = 50;

export interface PixelLogEntry {
  event: string;
  value?: number;
  orderId?: string;
  contentName?: string;
  at: number;
}

export function logPixelEvent(event: string, data: PixelEventData = {}) {
  try {
    const existing: PixelLogEntry[] = JSON.parse(localStorage.getItem(PIXEL_LOG_KEY) || "[]");
    existing.unshift({ event, value: data.value, orderId: data.orderId, contentName: data.contentName, at: Date.now() });
    localStorage.setItem(PIXEL_LOG_KEY, JSON.stringify(existing.slice(0, MAX_LOG)));
  } catch {}
}

export function getPixelLog(): PixelLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(PIXEL_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearPixelLog() {
  try { localStorage.removeItem(PIXEL_LOG_KEY); } catch {}
}
