/* Velocity website tracking snippet (M16). ~1KB, no cookies beyond a first-party session id. */
(function(){var s=document.currentScript,key=s&&s.getAttribute('data-site');if(!key)return;var ep=(s.src.replace(/\/t\.js.*$/,''))+'/api/t/v1';
var sid=(function(){try{var k='_vsid',v=localStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v)}return v}catch(e){return ''}})();
var q=new URLSearchParams(location.search),utm={};['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){if(q.get(k))utm[k]=q.get(k)});
var cid=q.get('vcid')||(function(){try{return sessionStorage.getItem('_vcid')}catch(e){return null}})();if(q.get('vcid')){try{sessionStorage.setItem('_vcid',q.get('vcid'))}catch(e){}}
function send(ev,extra){var p=Object.assign({site:key,sid:sid,event:ev,path:location.pathname,referrer:document.referrer,utm:utm,click_id:cid||undefined,device:/Mobi/.test(navigator.userAgent)?'mobile':'desktop',ts:new Date().toISOString()},extra||{});
try{navigator.sendBeacon?navigator.sendBeacon(ep,new Blob([JSON.stringify(p)],{type:'application/json'})):fetch(ep,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p),keepalive:true})}catch(e){}}
send('pageview');window.velocity=window.velocity||{};window.velocity.track=function(ev,props){send(ev,{props:props||{},value:props&&props.value,currency:props&&props.currency,order_id:props&&props.order_id})};
var h=history.pushState;history.pushState=function(){h.apply(this,arguments);send('pageview')};})();
