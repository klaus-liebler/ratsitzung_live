var Lt=Object.create;var K=Object.defineProperty;var Wt=Object.getOwnPropertyDescriptor;var gt=(n,t)=>(t=Symbol[n])?t:Symbol.for("Symbol."+n),j=n=>{throw TypeError(n)};var qt=(n,t,e)=>t in n?K(n,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):n[t]=e;var $t=(n,t)=>K(n,"name",{value:t,configurable:!0});var P=n=>[,,,Lt((n==null?void 0:n[gt("metadata")])??null)],wt=["class","method","getter","setter","accessor","field","value","get","set"],D=n=>n!==void 0&&typeof n!="function"?j("Function expected"):n,Zt=(n,t,e,s,i)=>({kind:wt[n],name:t,metadata:s,addInitializer:r=>e._?j("Already initialized"):i.push(D(r||null))}),Kt=(n,t)=>qt(t,gt("metadata"),n[3]),C=(n,t,e,s)=>{for(var i=0,r=n[t>>1],o=r&&r.length;i<o;i++)t&1?r[i].call(e):s=r[i].call(e,s);return s},k=(n,t,e,s,i,r)=>{var o,a,l,d,u,h=t&7,m=!!(t&8),p=!!(t&16),S=h>3?n.length+1:h?m?1:2:0,ut=wt[h+5],pt=h>3&&(n[S-1]=[]),Jt=n[S]||(n[S]=[]),g=h&&(!p&&!m&&(i=i.prototype),h<5&&(h>3||!p)&&Wt(h<4?i:{get[e](){return mt(this,r)},set[e](f){return ft(this,r,f)}},e));h?p&&h<4&&$t(r,(h>2?"set ":h>1?"get ":"")+e):$t(i,e);for(var q=s.length-1;q>=0;q--)d=Zt(h,e,l={},n[3],Jt),h&&(d.static=m,d.private=p,u=d.access={has:p?f=>Gt(i,f):f=>e in f},h^3&&(u.get=p?f=>(h^1?mt:Vt)(f,i,h^4?r:g.get):f=>f[e]),h>2&&(u.set=p?(f,Z)=>ft(f,i,Z,h^4?r:g.set):(f,Z)=>f[e]=Z)),a=(0,s[q])(h?h<4?p?r:g[ut]:h>4?void 0:{get:g.get,set:g.set}:i,d),l._=1,h^4||a===void 0?D(a)&&(h>4?pt.unshift(a):h?p?r=a:g[ut]=a:i=a):typeof a!="object"||a===null?j("Object expected"):(D(o=a.get)&&(g.get=o),D(o=a.set)&&(g.set=o),D(o=a.init)&&pt.unshift(o));return h||Kt(n,i),g&&K(i,e,g),p?h^4?r:g:i};var G=(n,t,e)=>t.has(n)||j("Cannot "+e),Gt=(n,t)=>Object(t)!==t?j('Cannot use the "in" operator on this value'):n.has(t),mt=(n,t,e)=>(G(n,t,"read from private field"),e?e.call(n):t.get(n));var ft=(n,t,e,s)=>(G(n,t,"write to private field"),s?s.call(n,e):t.set(n,e),e),Vt=(n,t,e)=>(G(n,t,"access private method"),e);/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const J=globalThis,dt=J.ShadowRoot&&(J.ShadyCSS===void 0||J.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Nt=Symbol(),St=new WeakMap;let Ft=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==Nt)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(dt&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=St.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&St.set(e,t))}return t}toString(){return this.cssText}};const Qt=n=>new Ft(typeof n=="string"?n:n+"",void 0,Nt),Xt=(n,t)=>{if(dt)n.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),i=J.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=e.cssText,n.appendChild(s)}},bt=dt?n=>n:n=>n instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return Qt(e)})(n):n;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Yt,defineProperty:te,getOwnPropertyDescriptor:ee,getOwnPropertyNames:se,getOwnPropertySymbols:ie,getPrototypeOf:ne}=Object,v=globalThis,vt=v.trustedTypes,re=vt?vt.emptyScript:"",V=v.reactiveElementPolyfillSupport,z=(n,t)=>n,lt={toAttribute(n,t){switch(t){case Boolean:n=n?re:null;break;case Object:case Array:n=n==null?n:JSON.stringify(n)}return n},fromAttribute(n,t){let e=n;switch(t){case Boolean:e=n!==null;break;case Number:e=n===null?null:Number(n);break;case Object:case Array:try{e=JSON.parse(n)}catch{e=null}}return e}},xt=(n,t)=>!Yt(n,t),yt={attribute:!0,type:String,converter:lt,reflect:!1,useDefault:!1,hasChanged:xt};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),v.litPropertyMetadata??(v.litPropertyMetadata=new WeakMap);let O=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=yt){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);i!==void 0&&te(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:r}=ee(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:i,set(o){const a=i==null?void 0:i.call(this);r==null||r.call(this,o),this.requestUpdate(t,a,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??yt}static _$Ei(){if(this.hasOwnProperty(z("elementProperties")))return;const t=ne(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(z("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(z("properties"))){const e=this.properties,s=[...se(e),...ie(e)];for(const i of s)this.createProperty(i,e[i])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,i]of e)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const i=this._$Eu(e,s);i!==void 0&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)e.unshift(bt(i))}else t!==void 0&&e.push(bt(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Xt(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var s;return(s=e.hostConnected)==null?void 0:s.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var s;return(s=e.hostDisconnected)==null?void 0:s.call(e)})}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){var r;const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const o=(((r=s.converter)==null?void 0:r.toAttribute)!==void 0?s.converter:lt).toAttribute(e,s.type);this._$Em=t,o==null?this.removeAttribute(i):this.setAttribute(i,o),this._$Em=null}}_$AK(t,e){var r,o;const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const a=s.getPropertyOptions(i),l=typeof a.converter=="function"?{fromAttribute:a.converter}:((r=a.converter)==null?void 0:r.fromAttribute)!==void 0?a.converter:lt;this._$Em=i;const d=l.fromAttribute(e,a.type);this[i]=d??((o=this._$Ej)==null?void 0:o.get(i))??d,this._$Em=null}}requestUpdate(t,e,s,i=!1,r){var o;if(t!==void 0){const a=this.constructor;if(i===!1&&(r=this[t]),s??(s=a.getPropertyOptions(t)),!((s.hasChanged??xt)(r,e)||s.useDefault&&s.reflect&&r===((o=this._$Ej)==null?void 0:o.get(t))&&!this.hasAttribute(a._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:r},o){s&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,o??e??this[t]),r!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),i===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var s;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[r,o]of this._$Ep)this[r]=o;this._$Ep=void 0}const i=this.constructor.elementProperties;if(i.size>0)for(const[r,o]of i){const{wrapped:a}=o,l=this[r];a!==!0||this._$AL.has(r)||l===void 0||this.C(r,void 0,o,l)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),(s=this._$EO)==null||s.forEach(i=>{var r;return(r=i.hostUpdate)==null?void 0:r.call(i)}),this.update(e)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(s=>{var i;return(i=s.hostUpdated)==null?void 0:i.call(s)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};O.elementStyles=[],O.shadowRootOptions={mode:"open"},O[z("elementProperties")]=new Map,O[z("finalized")]=new Map,V==null||V({ReactiveElement:O}),(v.reactiveElementVersions??(v.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const N=globalThis,_t=n=>n,L=N.trustedTypes,Et=L?L.createPolicy("lit-html",{createHTML:n=>n}):void 0,Rt="$lit$",b=`lit$${Math.random().toFixed(9).slice(2)}$`,Ut="?"+b,oe=`<${Ut}>`,A=document,x=()=>A.createComment(""),R=n=>n===null||typeof n!="object"&&typeof n!="function",ct=Array.isArray,ae=n=>ct(n)||typeof(n==null?void 0:n[Symbol.iterator])=="function",F=`[ 	
\f\r]`,I=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,At=/-->/g,Pt=/>/g,y=RegExp(`>|${F}(?:([^\\s"'>=/]+)(${F}*=${F}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Ct=/'/g,kt=/"/g,Ht=/^(?:script|style|textarea|title)$/i,he=n=>(t,...e)=>({_$litType$:n,strings:t,values:e}),c=he(1),T=Symbol.for("lit-noChange"),$=Symbol.for("lit-nothing"),Ot=new WeakMap,_=A.createTreeWalker(A,129);function Bt(n,t){if(!ct(n)||!n.hasOwnProperty("raw"))throw Error("invalid template strings array");return Et!==void 0?Et.createHTML(t):t}const le=(n,t)=>{const e=n.length-1,s=[];let i,r=t===2?"<svg>":t===3?"<math>":"",o=I;for(let a=0;a<e;a++){const l=n[a];let d,u,h=-1,m=0;for(;m<l.length&&(o.lastIndex=m,u=o.exec(l),u!==null);)m=o.lastIndex,o===I?u[1]==="!--"?o=At:u[1]!==void 0?o=Pt:u[2]!==void 0?(Ht.test(u[2])&&(i=RegExp("</"+u[2],"g")),o=y):u[3]!==void 0&&(o=y):o===y?u[0]===">"?(o=i??I,h=-1):u[1]===void 0?h=-2:(h=o.lastIndex-u[2].length,d=u[1],o=u[3]===void 0?y:u[3]==='"'?kt:Ct):o===kt||o===Ct?o=y:o===At||o===Pt?o=I:(o=y,i=void 0);const p=o===y&&n[a+1].startsWith("/>")?" ":"";r+=o===I?l+oe:h>=0?(s.push(d),l.slice(0,h)+Rt+l.slice(h)+b+p):l+b+(h===-2?a:p)}return[Bt(n,r+(n[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class U{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let r=0,o=0;const a=t.length-1,l=this.parts,[d,u]=le(t,e);if(this.el=U.createElement(d,s),_.currentNode=this.el.content,e===2||e===3){const h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(i=_.nextNode())!==null&&l.length<a;){if(i.nodeType===1){if(i.hasAttributes())for(const h of i.getAttributeNames())if(h.endsWith(Rt)){const m=u[o++],p=i.getAttribute(h).split(b),S=/([.?@])?(.*)/.exec(m);l.push({type:1,index:r,name:S[2],strings:p,ctor:S[1]==="."?ce:S[1]==="?"?ue:S[1]==="@"?pe:W}),i.removeAttribute(h)}else h.startsWith(b)&&(l.push({type:6,index:r}),i.removeAttribute(h));if(Ht.test(i.tagName)){const h=i.textContent.split(b),m=h.length-1;if(m>0){i.textContent=L?L.emptyScript:"";for(let p=0;p<m;p++)i.append(h[p],x()),_.nextNode(),l.push({type:2,index:++r});i.append(h[m],x())}}}else if(i.nodeType===8)if(i.data===Ut)l.push({type:2,index:r});else{let h=-1;for(;(h=i.data.indexOf(b,h+1))!==-1;)l.push({type:7,index:r}),h+=b.length-1}r++}}static createElement(t,e){const s=A.createElement("template");return s.innerHTML=t,s}}function M(n,t,e=n,s){var o,a;if(t===T)return t;let i=s!==void 0?(o=e._$Co)==null?void 0:o[s]:e._$Cl;const r=R(t)?void 0:t._$litDirective$;return(i==null?void 0:i.constructor)!==r&&((a=i==null?void 0:i._$AO)==null||a.call(i,!1),r===void 0?i=void 0:(i=new r(n),i._$AT(n,e,s)),s!==void 0?(e._$Co??(e._$Co=[]))[s]=i:e._$Cl=i),i!==void 0&&(t=M(n,i._$AS(n,t.values),i,s)),t}class de{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=((t==null?void 0:t.creationScope)??A).importNode(e,!0);_.currentNode=i;let r=_.nextNode(),o=0,a=0,l=s[0];for(;l!==void 0;){if(o===l.index){let d;l.type===2?d=new H(r,r.nextSibling,this,t):l.type===1?d=new l.ctor(r,l.name,l.strings,this,t):l.type===6&&(d=new $e(r,this,t)),this._$AV.push(d),l=s[++a]}o!==(l==null?void 0:l.index)&&(r=_.nextNode(),o++)}return _.currentNode=A,i}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class H{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=$,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=(i==null?void 0:i.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=M(this,t,e),R(t)?t===$||t==null||t===""?(this._$AH!==$&&this._$AR(),this._$AH=$):t!==this._$AH&&t!==T&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):ae(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==$&&R(this._$AH)?this._$AA.nextSibling.data=t:this.T(A.createTextNode(t)),this._$AH=t}$(t){var r;const{values:e,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=U.createElement(Bt(s.h,s.h[0]),this.options)),s);if(((r=this._$AH)==null?void 0:r._$AD)===i)this._$AH.p(e);else{const o=new de(i,this),a=o.u(this.options);o.p(e),this.T(a),this._$AH=o}}_$AC(t){let e=Ot.get(t.strings);return e===void 0&&Ot.set(t.strings,e=new U(t)),e}k(t){ct(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const r of t)i===e.length?e.push(s=new H(this.O(x()),this.O(x()),this,this.options)):s=e[i],s._$AI(r),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){var s;for((s=this._$AP)==null?void 0:s.call(this,!1,!0,e);t!==this._$AB;){const i=_t(t).nextSibling;_t(t).remove(),t=i}}setConnected(t){var e;this._$AM===void 0&&(this._$Cv=t,(e=this._$AP)==null||e.call(this,t))}}class W{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,r){this.type=1,this._$AH=$,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=r,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=$}_$AI(t,e=this,s,i){const r=this.strings;let o=!1;if(r===void 0)t=M(this,t,e,0),o=!R(t)||t!==this._$AH&&t!==T,o&&(this._$AH=t);else{const a=t;let l,d;for(t=r[0],l=0;l<r.length-1;l++)d=M(this,a[s+l],e,l),d===T&&(d=this._$AH[l]),o||(o=!R(d)||d!==this._$AH[l]),d===$?t=$:t!==$&&(t+=(d??"")+r[l+1]),this._$AH[l]=d}o&&!i&&this.j(t)}j(t){t===$?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class ce extends W{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===$?void 0:t}}class ue extends W{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==$)}}class pe extends W{constructor(t,e,s,i,r){super(t,e,s,i,r),this.type=5}_$AI(t,e=this){if((t=M(this,t,e,0)??$)===T)return;const s=this._$AH,i=t===$&&s!==$||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,r=t!==$&&(s===$||i);i&&this.element.removeEventListener(this.name,this,s),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}}class $e{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){M(this,t)}}const Q=N.litHtmlPolyfillSupport;Q==null||Q(U,H),(N.litHtmlVersions??(N.litHtmlVersions=[])).push("3.3.3");const me=(n,t,e)=>{const s=(e==null?void 0:e.renderBefore)??t;let i=s._$litPart$;if(i===void 0){const r=(e==null?void 0:e.renderBefore)??null;s._$litPart$=i=new H(t.insertBefore(x(),r),r,void 0,e??{})}return i._$AI(n),i};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=globalThis;class w extends O{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=me(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return T}}var Tt;w._$litElement$=!0,w.finalized=!0,(Tt=E.litElementHydrateSupport)==null||Tt.call(E,{LitElement:w});const X=E.litElementPolyfillSupport;X==null||X({LitElement:w});(E.litElementVersions??(E.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const B=n=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(n,t)}):customElements.define(n,t)};var Mt,nt,fe;Mt=[B("login-card")];class Y extends(fe=w){constructor(){super(...arguments),this.username="",this.password="",this.error="",this.isBusy=!1}createRenderRoot(){return this}onUsernameInput(t){const e=t.target.value;this.dispatchEvent(new CustomEvent("username-change",{detail:e,bubbles:!0,composed:!0}))}onPasswordInput(t){const e=t.target.value;this.dispatchEvent(new CustomEvent("password-change",{detail:e,bubbles:!0,composed:!0}))}onSubmit(){this.dispatchEvent(new CustomEvent("submit-login",{bubbles:!0,composed:!0}))}render(){return c`
      <div class="card">
        <h2>Login</h2>
        <div class="row">
          <label for="username">Benutzername</label>
          <input
            id="username"
            .value=${this.username}
            @input=${this.onUsernameInput}
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>
        <div class="row">
          <label for="password">Passwort</label>
          <input
            id="password"
            type="password"
            .value=${this.password}
            @input=${this.onPasswordInput}
            autocomplete="current-password"
          />
        </div>
        <button ?disabled=${this.isBusy} @click=${this.onSubmit}>Anmelden</button>
        <p class="error">${this.error}</p>
      </div>
    `}}nt=P(fe),Y=k(nt,0,"LoginCard",Mt,Y),C(nt,1,Y);var Dt,rt,ge;Dt=[B("change-password-card")];class tt extends(ge=w){constructor(){super(...arguments),this.newPassword="",this.newPasswordConfirm="",this.error="",this.success="",this.isBusy=!1}createRenderRoot(){return this}onPasswordInput(t){const e=t.target.value;this.dispatchEvent(new CustomEvent("new-password-change",{detail:e,bubbles:!0,composed:!0}))}onPasswordConfirmInput(t){const e=t.target.value;this.dispatchEvent(new CustomEvent("new-password-confirm-change",{detail:e,bubbles:!0,composed:!0}))}onSubmit(){this.dispatchEvent(new CustomEvent("submit-change-password",{bubbles:!0,composed:!0}))}render(){return c`
      <div class="card">
        <h2>Passwortwechsel erforderlich</h2>
        <p class="hint">Bitte sofort ein neues Passwort setzen (mind. 10 Zeichen, 1 Zahl, 1 Grossbuchstabe).</p>
        <div class="row">
          <label for="newPassword">Neues Passwort</label>
          <input
            id="newPassword"
            type="password"
            .value=${this.newPassword}
            @input=${this.onPasswordInput}
            autocomplete="new-password"
            minlength="10"
            pattern="(?=.*[A-Z])(?=.*[0-9]).{10,}"
            title="Mindestens 10 Zeichen, mindestens 1 Grossbuchstabe und 1 Zahl."
          />
        </div>
        <div class="row">
          <label for="newPasswordConfirm">Neues Passwort bestaetigen</label>
          <input
            id="newPasswordConfirm"
            type="password"
            .value=${this.newPasswordConfirm}
            @input=${this.onPasswordConfirmInput}
            autocomplete="new-password"
            minlength="10"
            pattern="(?=.*[A-Z])(?=.*[0-9]).{10,}"
            title="Mindestens 10 Zeichen, mindestens 1 Grossbuchstabe und 1 Zahl."
          />
        </div>
        <button ?disabled=${this.isBusy} @click=${this.onSubmit}>Passwort setzen</button>
        <p class="error">${this.error}</p>
        <p class="ok">${this.success}</p>
      </div>
    `}}rt=P(ge),tt=k(rt,0,"ChangePasswordCard",Dt,tt),C(rt,1,tt);var jt,ot,we;jt=[B("selection-panel")];class et extends(we=w){constructor(){super(...arguments),this.sessions=[],this.sessionsError="",this.canOpenSession=!1,this.openableCommittees=[],this.openError="",this.formatDateTime=()=>"-"}createRenderRoot(){return this}onJoin(t){this.dispatchEvent(new CustomEvent("join-session",{detail:t,bubbles:!0,composed:!0}))}onOpen(t){this.dispatchEvent(new CustomEvent("open-session",{detail:t,bubbles:!0,composed:!0}))}render(){return c`
      <p class="hint">Du bist aktuell keiner Sitzung beigetreten. Bitte Sitzung waehlen oder eroeffnen.</p>

      <h3>Aktive Sitzungen</h3>
      <p class="error">${this.sessionsError}</p>
      ${this.sessions.length===0?c`<p class="hint">Aktuell sind keine Sitzungen aktiv.</p>`:c`
            <table>
              <thead>
                <tr>
                  <th>Gremium</th>
                  <th>Start</th>
                  <th>Eroeffnet durch</th>
                  <th>Teilnehmer</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                ${this.sessions.map(t=>c`
                    <tr>
                      <td>${t.committeeName}</td>
                      <td>${this.formatDateTime(t.startDt)}</td>
                      <td>${t.startedByDisplayName??"-"}</td>
                      <td>${t.activeParticipants??0}</td>
                      <td class="action">
                        ${t.isJoined?c`<span class="ok">Beigetreten</span>`:c`<button class="small" @click=${()=>this.onJoin(t.sessionId)}>Beitreten</button>`}
                      </td>
                    </tr>
                  `)}
              </tbody>
            </table>
          `}

      ${this.canOpenSession?c`
            <h3>Sitzung eroeffnen</h3>
            <p class="error">${this.openError}</p>
            ${this.openableCommittees.length===0?c`<p class="hint">Keine Gremien verfuegbar, die du aktuell eroefnen kannst.</p>`:c`
                  <table>
                    <thead>
                      <tr><th>Gremium</th><th>Aktion</th></tr>
                    </thead>
                    <tbody>
                      ${this.openableCommittees.map(t=>c`
                          <tr>
                            <td>${t.committeeName}</td>
                            <td class="action"><button class="small" @click=${()=>this.onOpen(t.committeeId)}>Sitzung eroeffnen</button></td>
                          </tr>
                        `)}
                    </tbody>
                  </table>
                `}
          `:null}
    `}}ot=P(we),et=k(ot,0,"SelectionPanel",jt,et),C(ot,1,et);var It,at,Se;It=[B("joined-panel")];class st extends(Se=w){constructor(){super(...arguments),this.joinedSessionId=0,this.participantsError="",this.sessionStatus="",this.hasSpeechRequest=!1,this.participantsData=null,this.isChairOfJoinedSession=!1,this.chairError="",this.chairState=null,this.formatDateTime=()=>"-",this.formatDuration=()=>"00:00:00"}createRenderRoot(){return this}emit(t){this.dispatchEvent(new CustomEvent(t,{bubbles:!0,composed:!0}))}render(){var e,s,i,r,o;const t=((e=this.participantsData)==null?void 0:e.participants)??[];return c`
      <p class="hint">Du bist Sitzung ${this.joinedSessionId} beigetreten.</p>
      <p class="error">${this.participantsError}</p>
      <p class="ok">${this.sessionStatus}</p>
      <button @click=${()=>this.emit("toggle-speech")}>${this.hasSpeechRequest?"Wortmeldung zuruecknehmen":"Wortmeldung"}</button>
      <button class="secondary" @click=${()=>this.emit("leave-session")}>Sitzung verlassen</button>

      ${this.isChairOfJoinedSession?c`
            <div class="card">
              <h3>Leitung und Steuerung (Chair)</h3>
              <p class="error">${this.chairError}</p>
              <div>
                <span class="kpi">Sitzungsbeginn: <b>${this.formatDateTime((s=this.chairState)==null?void 0:s.sessionStartDt)}</b></span>
                <span class="kpi">Dauer: <b>${this.formatDuration((i=this.chairState)==null?void 0:i.durationSeconds)}</b></span>
                <span class="kpi">Status: <b>${(r=this.chairState)!=null&&r.isStarted?"Gestartet":"Nicht gestartet"}</b></span>
              </div>
              <button ?disabled=${!!((o=this.chairState)!=null&&o.isStarted)} @click=${()=>this.emit("chair-start")}>Sitzung starten</button>
              <button class="secondary" @click=${()=>this.emit("chair-end")}>Sitzung beenden</button>
            </div>
          `:null}

      <h3>Angemeldete Benutzer</h3>
      ${t.length===0?c`<p class="hint">Keine Teilnehmer gefunden.</p>`:c`
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Benutzer</th>
                  <th>Beigetreten</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${t.map(a=>{var d;const l=a.userId===((d=this.participantsData)==null?void 0:d.myUserId);return c`
                    <tr class=${l?"mine":""}>
                      <td>
                        ${a.displayName||a.username}
                        ${l?c`<span class="mine-label">(Du)</span>`:null}
                      </td>
                      <td>${a.username||"-"}</td>
                      <td>${this.formatDateTime(a.joinedAt)}</td>
                      <td>${a.hasSpeechRequest?c`<span class="badge">Wortmeldung</span>`:c`<span class="hint">-</span>`}</td>
                    </tr>
                  `})}
              </tbody>
            </table>
          `}
    `}}at=P(Se),st=k(at,0,"JoinedPanel",It,st),C(at,1,st);var zt,ht,be;zt=[B("ratlive-dashboard-app")];class it extends(be=w){constructor(){super(...arguments),this.viewMode="login",this.statusMessage="Bitte anmelden.",this.statusClass="",this.username="rat1",this.password="Initial123!",this.newPassword="",this.newPasswordConfirm="",this.loginError="",this.changePwdError="",this.changePwdOk="",this.me=null,this.profileJson="",this.sessions=[],this.sessionsError="",this.openableCommittees=[],this.openError="",this.participantsError="",this.participantsData=null,this.sessionStatus="",this.joinedSessionId=null,this.isChairOfJoinedSession=!1,this.chairError="",this.chairState=null,this.isBusy=!1,this.tokenKey="ratlive_token",this.pollHandle=null}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.bootstrap()}disconnectedCallback(){super.disconnectedCallback(),this.stopPolling()}async bootstrap(){if(!this.token()){this.viewMode="login",this.statusMessage="Bitte anmelden.",this.statusClass="";return}await this.loadDashboardState(),this.startPolling()}token(){return localStorage.getItem(this.tokenKey)}setToken(t){t?localStorage.setItem(this.tokenKey,t):localStorage.removeItem(this.tokenKey)}async api(t,e={}){const s=new Headers(e.headers??void 0),i=this.token();return i&&s.set("Authorization",`Bearer ${i}`),e.body&&!s.has("Content-Type")&&s.set("Content-Type","application/json"),fetch(t,{...e,headers:s})}stopPolling(){this.pollHandle!==null&&(window.clearInterval(this.pollHandle),this.pollHandle=null)}startPolling(){this.stopPolling(),this.pollHandle=window.setInterval(()=>{this.loadDashboardState()},3e3)}formatDateTime(t){return t?t.replace("T"," "):"-"}formatDuration(t){const e=Number(t??0),s=Math.floor(e/3600).toString().padStart(2,"0"),i=Math.floor(e%3600/60).toString().padStart(2,"0"),r=Math.floor(e%60).toString().padStart(2,"0");return`${s}:${i}:${r}`}async loadActiveSessions(){this.sessionsError="";const t=await this.api("/api/sessions/active");if(!t.ok)return this.sessionsError="Aktive Sitzungen konnten nicht geladen werden.",this.sessions=[],[];const e=await t.json();return this.sessions=Array.isArray(e)?e:[],this.sessions}async loadOpenableCommittees(){var s;if(this.openError="",!((s=this.me)!=null&&s.canOpenSession)){this.openableCommittees=[];return}const t=await this.api("/api/sessions/openable");if(!t.ok){this.openError="Liste fuer Sitzungseroeffnung konnte nicht geladen werden.",this.openableCommittees=[];return}const e=await t.json();this.openableCommittees=Array.isArray(e)?e:[]}async loadParticipants(t){this.participantsError="";const e=await this.api(`/api/sessions/${t}/participants`);if(!e.ok){this.participantsError="Teilnehmerliste konnte nicht geladen werden.",this.participantsData=null;return}this.participantsData=await e.json()}async loadChairState(){if(!this.joinedSessionId||!this.isChairOfJoinedSession){this.chairState=null;return}this.chairError="";const t=await this.api(`/api/sessions/${this.joinedSessionId}/chair/state`);if(!t.ok){this.chairError="Chair-Status konnte nicht geladen werden.",this.chairState=null;return}this.chairState=await t.json()}async loadDashboardState(){const t=await this.api("/api/auth/me");if(!t.ok){this.stopPolling(),this.setToken(null),this.viewMode="login",this.statusMessage="Nicht angemeldet.",this.statusClass="",this.me=null;return}const e=await t.json();if(this.me=e,this.profileJson=JSON.stringify(e,null,2),e.mustChangePassword){this.stopPolling(),this.viewMode="change-password",this.statusMessage="Passwortwechsel erforderlich.",this.statusClass="error";return}this.viewMode="app",this.statusMessage="Angemeldet.",this.statusClass="ok";const i=(await this.loadActiveSessions()).find(r=>r.isJoined);if(i){this.joinedSessionId=i.sessionId,this.isChairOfJoinedSession=Number(i.startUserId)===Number(e.id),await this.loadParticipants(i.sessionId),await this.loadChairState();return}this.joinedSessionId=null,this.isChairOfJoinedSession=!1,this.participantsData=null,this.chairState=null,await this.loadOpenableCommittees()}async login(){this.loginError="",this.isBusy=!0;try{const t=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:this.username,password:this.password})});if(!t.ok){this.loginError="Login fehlgeschlagen.";return}const e=await t.json();this.setToken(e.accessToken),await this.loadDashboardState(),this.startPolling()}finally{this.isBusy=!1}}async changePassword(){if(this.changePwdError="",this.changePwdOk="",this.newPassword!==this.newPasswordConfirm){this.changePwdError="Die Passwoerter sind nicht identisch.";return}this.isBusy=!0;try{const t=await this.api("/api/auth/change-password",{method:"POST",body:JSON.stringify({newPassword:this.newPassword})});if(!t.ok){const e=await t.json().catch(()=>({error:"Aenderung fehlgeschlagen."}));this.changePwdError=e.error??"Aenderung fehlgeschlagen.";return}this.changePwdOk="Passwort erfolgreich gesetzt.",this.newPassword="",this.newPasswordConfirm="",await this.loadDashboardState(),this.startPolling()}finally{this.isBusy=!1}}async joinSession(t){if(this.sessionsError="",!(await this.api(`/api/sessions/${t}/join`,{method:"POST"})).ok){this.sessionsError="Beitritt fehlgeschlagen.";return}await this.loadDashboardState()}async openSession(t){this.openError="";const e=await this.api("/api/sessions/open",{method:"POST",body:JSON.stringify({committeeId:t})});if(!e.ok){const s=await e.json().catch(()=>({error:"Sitzung konnte nicht eroeffnet werden."}));this.openError=s.error??"Sitzung konnte nicht eroeffnet werden.";return}await this.loadDashboardState()}async toggleSpeechRequest(){if(!this.joinedSessionId)return;this.participantsError="",this.sessionStatus="";const t=await this.api(`/api/sessions/${this.joinedSessionId}/speech-request/toggle`,{method:"POST"});if(!t.ok){const e=await t.json().catch(()=>({error:"Wortmeldung konnte nicht geaendert werden."}));this.participantsError=e.error??"Wortmeldung konnte nicht geaendert werden.";return}this.sessionStatus="Wortmeldung aktualisiert.",await this.loadParticipants(this.joinedSessionId)}async leaveSession(){if(!this.joinedSessionId||!window.confirm("Moechtest du die Sitzung wirklich verlassen?"))return;if(this.participantsError="",!(await this.api(`/api/sessions/${this.joinedSessionId}/leave`,{method:"POST"})).ok){this.participantsError="Sitzung konnte nicht verlassen werden.";return}await this.loadDashboardState()}async chairStart(){if(!this.joinedSessionId||!this.isChairOfJoinedSession)return;this.chairError="";const t=await this.api(`/api/sessions/${this.joinedSessionId}/chair/start`,{method:"POST"});if(!t.ok){const e=await t.json().catch(()=>({error:"Sitzung konnte nicht gestartet werden."}));this.chairError=e.error??"Sitzung konnte nicht gestartet werden.";return}await this.loadChairState()}async chairEnd(){if(!this.joinedSessionId||!this.isChairOfJoinedSession||!window.confirm("Moechtest du die Sitzung wirklich beenden?"))return;this.chairError="";const e=await this.api(`/api/sessions/${this.joinedSessionId}/chair/end`,{method:"POST"});if(!e.ok){const s=await e.json().catch(()=>({error:"Sitzung konnte nicht beendet werden."}));this.chairError=s.error??"Sitzung konnte nicht beendet werden.";return}await this.loadDashboardState()}logout(){this.stopPolling(),this.setToken(null),this.viewMode="login",this.statusMessage="Abgemeldet.",this.statusClass=""}render(){var s,i,r,o;const t=this.viewMode==="app"&&!this.joinedSessionId,e=this.viewMode==="app"&&!!this.joinedSessionId;return c`
      <div class="wrap">
        <div class="card">
          <h1>RatLive - Dashboard</h1>
          <p class="hint">Eine Seite mit zwei Betriebsmodi: vor Beitritt (Sitzungsauswahl) und nach Beitritt (Sitzungsansicht).</p>
          <p class="hint">Demo-Login: <b>rat1</b> / <b>Initial123!</b></p>
          <p class=${this.statusClass}>${this.statusMessage}</p>
        </div>

        ${this.viewMode==="login"?c`
              <login-card
                .username=${this.username}
                .password=${this.password}
                .error=${this.loginError}
                .isBusy=${this.isBusy}
                @username-change=${a=>{this.username=a.detail}}
                @password-change=${a=>{this.password=a.detail}}
                @submit-login=${()=>void this.login()}
              ></login-card>
            `:null}

        ${this.viewMode==="change-password"?c`
              <change-password-card
                .newPassword=${this.newPassword}
                .newPasswordConfirm=${this.newPasswordConfirm}
                .error=${this.changePwdError}
                .success=${this.changePwdOk}
                .isBusy=${this.isBusy}
                @new-password-change=${a=>{this.newPassword=a.detail}}
                @new-password-confirm-change=${a=>{this.newPasswordConfirm=a.detail}}
                @submit-change-password=${()=>void this.changePassword()}
              ></change-password-card>
            `:null}

        ${this.viewMode==="app"?c`
              <div class="card">
                <h2>${e?"Sitzungsansicht":"Sitzungsauswahl"}</h2>
                <p>Willkommen ${(s=this.me)==null?void 0:s.displayName} (${(i=this.me)==null?void 0:i.username})</p>

                ${t?c`
                      <selection-panel
                        .sessions=${this.sessions}
                        .sessionsError=${this.sessionsError}
                        .canOpenSession=${!!((r=this.me)!=null&&r.canOpenSession)}
                        .openableCommittees=${this.openableCommittees}
                        .openError=${this.openError}
                        .formatDateTime=${this.formatDateTime.bind(this)}
                        @join-session=${a=>void this.joinSession(a.detail)}
                        @open-session=${a=>void this.openSession(a.detail)}
                      ></selection-panel>
                    `:null}

                ${e?c`
                      <joined-panel
                        .joinedSessionId=${this.joinedSessionId??0}
                        .participantsError=${this.participantsError}
                        .sessionStatus=${this.sessionStatus}
                        .hasSpeechRequest=${!!((o=this.participantsData)!=null&&o.hasMySpeechRequest)}
                        .participantsData=${this.participantsData}
                        .isChairOfJoinedSession=${this.isChairOfJoinedSession}
                        .chairError=${this.chairError}
                        .chairState=${this.chairState}
                        .formatDateTime=${this.formatDateTime.bind(this)}
                        .formatDuration=${this.formatDuration.bind(this)}
                        @toggle-speech=${()=>void this.toggleSpeechRequest()}
                        @leave-session=${()=>void this.leaveSession()}
                        @chair-start=${()=>void this.chairStart()}
                        @chair-end=${()=>void this.chairEnd()}
                      ></joined-panel>
                    `:null}

                <button class="secondary" @click=${()=>this.logout()}>Abmelden</button>
                <h3>Profil (API /api/auth/me)</h3>
                <pre>${this.profileJson}</pre>
              </div>
            `:null}
      </div>
    `}}ht=P(be),it=k(ht,0,"RatsitzungDashboardApp",zt,it),C(ht,1,it);
