/** 경제교실 AI 질문함 - Custom GPT Action용 Google Apps Script 웹앱 v1.1
 * 사용량 로그: classEconomy/main/aiUsageLogs에 원문 없이 토큰/비용/상태만 저장합니다.
 */
const FIREBASE_DATABASE_URL='https://economy-44982-default-rtdb.firebaseio.com';
const FIREBASE_BASE_PATH='classEconomy/main';
const AI_USAGE_PATH='aiUsageLogs';
const DOCUMENT_FOLDER_ID='';
const REQUIRE_TOKEN=false;
const DEFAULT_MODEL_NAME='custom-gpt';
const AI_MODEL_PRICING_USD_PER_1M={
  'custom-gpt':{input:0,output:0},
  'gpt-4o-mini':{input:0.15,output:0.60},
  'gpt-4o':{input:5.00,output:15.00},
  'gpt-4.1-mini':{input:0.40,output:1.60},
  'gpt-4.1':{input:2.00,output:8.00},
  'gemini-1.5-flash':{input:0.075,output:0.30},
  'claude-3-haiku':{input:0.25,output:1.25},
  default:{input:0,output:0}
};

function doPost(e){
  let payload={};
  try{
    payload=parseJson_(e); assertToken_(payload);
    const action=String(payload.action||'').trim();
    if(action==='health') return json_({ok:true,service:'economy-ai-question-bridge'});
    if(action==='getNextQuestion') return json_(getNextQuestion_());
    if(action==='saveAnswer') return json_(saveAnswer_(payload));
    if(action==='markNeedsTeacherReview') return json_(markNeedsTeacherReview_(payload));
    logAiUsage_({featureName:action||'unknown_action',userRole:'system',modelName:modelName_(payload),error:true,errorCode:'UNKNOWN_ACTION',errorMessage:'지원하지 않는 action입니다.'});
    return json_({ok:false,error:'UNKNOWN_ACTION',message:'지원하지 않는 action입니다.'});
  }catch(err){
    logAiUsage_({featureName:String(payload.action||'server_error'),userRole:'system',modelName:modelName_(payload),error:true,errorCode:'SERVER_ERROR',errorMessage:String(err&&err.message?err.message:err).slice(0,500)});
    return json_({ok:false,error:'SERVER_ERROR',message:String(err&&err.message?err.message:err)});
  }
}
function doGet(){return json_({ok:true,service:'economy-ai-question-bridge',hint:'POST로 action을 보내세요.'});}
function parseJson_(e){return !e||!e.postData||!e.postData.contents?{}:JSON.parse(e.postData.contents);}
function assertToken_(payload){
  if(!REQUIRE_TOKEN) return;
  const expected=String(PropertiesService.getScriptProperties().getProperty('BRIDGE_TOKEN')||'');
  if(!expected) throw new Error('BRIDGE_TOKEN이 Script Properties에 없습니다.');
  if(String(payload.bridgeToken||'')!==expected) throw new Error('Bridge token mismatch');
}
function firebaseUrl_(path){
  const cleanPath=[FIREBASE_BASE_PATH,path].filter(Boolean).join('/').replace(/\/+/g,'/');
  return FIREBASE_DATABASE_URL.replace(/\/$/,'')+'/'+cleanPath+'.json';
}
function fbGet_(path){const res=UrlFetchApp.fetch(firebaseUrl_(path),{method:'get',muteHttpExceptions:true});return JSON.parse(res.getContentText()||'null');}
function fbPatch_(path,data){
  const res=UrlFetchApp.fetch(firebaseUrl_(path),{method:'patch',contentType:'application/json',payload:JSON.stringify(data),muteHttpExceptions:true});
  const code=res.getResponseCode();
  if(code<200||code>=300) throw new Error('Firebase patch failed: '+code+' '+res.getContentText());
  return JSON.parse(res.getContentText()||'null');
}
function nowIso_(){return new Date().toISOString();}
function nowKstText_(){return Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm:ss');}
function nextId_(prefix){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
function asList_(map){return Object.keys(map||{}).map(function(id){const value=map[id]||{};value.id=value.id||id;return value;});}

function getNextQuestion_(){
  const requests=asList_(fbGet_('aiQuestionRequests')).filter(function(r){return (r.status||'waiting')==='waiting';}).sort(function(a,b){return String(a.createdAt||'').localeCompare(String(b.createdAt||''));});
  if(!requests.length) return {ok:true,hasQuestion:false,message:'대기 질문이 없습니다.'};
  const req=requests[0];
  fbPatch_('aiQuestionRequests/'+req.id,{status:'processing',processingStartedAt:nowIso_(),updatedAt:nowIso_()});
  return {ok:true,hasQuestion:true,requestId:req.id,studentId:req.studentId||'',studentName:req.studentName||'',mode:req.mode||'concept',question:req.question||'',createdAt:req.createdAt||''};
}

function saveAnswer_(payload){
  const requestId=String(payload.requestId||'').trim();
  const studentId=String(payload.studentId||'').trim();
  const studentName=String(payload.studentName||'').trim();
  const question=String(payload.question||'').trim();
  const answer=String(payload.answer||'').trim();
  if(!requestId) throw new Error('requestId가 필요합니다.');
  if(!studentId) throw new Error('studentId가 필요합니다.');
  if(!answer) throw new Error('answer가 필요합니다.');

  const doc=DocumentApp.create('AI 답변 - '+(studentName||studentId)+' - '+Utilities.formatDate(new Date(),'Asia/Seoul','MM-dd HH:mm'));
  const body=doc.getBody();
  body.appendParagraph('경제교실 AI 답변').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('학생: '+(studentName||studentId));
  body.appendParagraph('생성 시각: '+Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm'));
  body.appendParagraph('');
  body.appendParagraph('학생 질문').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(question||'(질문 내용 없음)');
  body.appendParagraph('');
  body.appendParagraph('AI 답변').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  answer.split('\n').forEach(function(line){body.appendParagraph(line);});
  body.appendParagraph('');
  body.appendParagraph('※ 이 답변은 AI가 생성했으며, 수업에서는 선생님 안내를 우선합니다.').setItalic(true);
  doc.saveAndClose();

  const file=DriveApp.getFileById(doc.getId());
  if(DOCUMENT_FOLDER_ID){const folder=DriveApp.getFolderById(DOCUMENT_FOLDER_ID);folder.addFile(file);DriveApp.getRootFolder().removeFile(file);}
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  const documentUrl=doc.getUrl();
  const now=nowIso_();
  const preview=answer.replace(/\s+/g,' ').slice(0,140);
  const roomId='room_'+studentId;
  const msgId=nextId_('tx');
  const messageText='🤖 AI 답변 문서가 도착했습니다.\n'+documentUrl;
  const room=fbGet_('teacherMessageRooms/'+roomId)||{};
  const updates={};
  updates['aiQuestionRequests/'+requestId+'/status']='completed';
  updates['aiQuestionRequests/'+requestId+'/documentUrl']=documentUrl;
  updates['aiQuestionRequests/'+requestId+'/answerPreview']=preview;
  updates['aiQuestionRequests/'+requestId+'/answeredAt']=now;
  updates['aiQuestionRequests/'+requestId+'/updatedAt']=now;
  updates['teacherMessages/'+msgId]={id:msgId,roomId:roomId,senderId:'teacher',senderName:'선생님 AI 답변',senderRole:'teacher',text:messageText,createdAt:now,readByTeacher:true,readByStudent:false,deleted:false,aiRequestId:requestId,documentUrl:documentUrl};
  updates['teacherMessageRooms/'+roomId+'/id']=roomId;
  updates['teacherMessageRooms/'+roomId+'/studentId']=studentId;
  updates['teacherMessageRooms/'+roomId+'/studentName']=studentName||studentId;
  updates['teacherMessageRooms/'+roomId+'/teacherId']='teacher';
  updates['teacherMessageRooms/'+roomId+'/lastMessage']=messageText;
  updates['teacherMessageRooms/'+roomId+'/lastMessageAt']=now;
  updates['teacherMessageRooms/'+roomId+'/lastSenderRole']='teacher';
  updates['teacherMessageRooms/'+roomId+'/unreadByStudent']=Number(room.unreadByStudent||0)+1;
  updates['teacherMessageRooms/'+roomId+'/unreadByTeacher']=0;
  updates['teacherMessageRooms/'+roomId+'/updatedAt']=now;
  updates['teacherMessageRooms/'+roomId+'/closed']=false;
  fbPatch_('',updates);

  logAiUsage_({featureName:'ai_question_answer',userId:studentId,userRole:'student',modelName:modelName_(payload),requestId:requestId,promptTokens:tokenNumber_(payload.promptTokens,payload.prompt_tokens,estimatePromptTokens_(question)),completionTokens:tokenNumber_(payload.completionTokens,payload.completion_tokens,estimateTokens_(answer)),totalTokens:tokenNumber_(payload.totalTokens,payload.total_tokens,null),isEstimated:!hasAnyUsageTokens_(payload),error:false});
  return {ok:true,requestId:requestId,documentUrl:documentUrl,messageId:msgId};
}

function markNeedsTeacherReview_(payload){
  const requestId=String(payload.requestId||'').trim();
  if(!requestId) throw new Error('requestId가 필요합니다.');
  const reason=String(payload.reason||'교사 직접 검토 필요').slice(0,300);
  fbPatch_('aiQuestionRequests/'+requestId,{status:'review',reviewReason:reason,updatedAt:nowIso_()});
  logAiUsage_({featureName:'ai_question_review',userRole:'student',modelName:modelName_(payload),requestId:requestId,promptTokens:tokenNumber_(payload.promptTokens,payload.prompt_tokens,0),completionTokens:tokenNumber_(payload.completionTokens,payload.completion_tokens,0),totalTokens:tokenNumber_(payload.totalTokens,payload.total_tokens,0),isEstimated:!hasAnyUsageTokens_(payload),error:false});
  return {ok:true,requestId:requestId,status:'review'};
}

function modelName_(payload){return String((payload&&(payload.modelName||payload.model||payload.model_name))||DEFAULT_MODEL_NAME).trim()||DEFAULT_MODEL_NAME;}
function hasAnyUsageTokens_(payload){return payload&&(payload.promptTokens!==undefined||payload.prompt_tokens!==undefined||payload.completionTokens!==undefined||payload.completion_tokens!==undefined||payload.totalTokens!==undefined||payload.total_tokens!==undefined);}
function tokenNumber_(a,b,fallback){const first=Number(a);if(Number.isFinite(first)&&first>=0)return Math.round(first);const second=Number(b);if(Number.isFinite(second)&&second>=0)return Math.round(second);const fb=Number(fallback);return Number.isFinite(fb)&&fb>=0?Math.round(fb):0;}
function estimateTokens_(text){const clean=String(text||'').replace(/\s+/g,' ').trim();return clean?Math.max(1,Math.ceil(clean.length/2)):0;}
function estimatePromptTokens_(question){const fixedInstruction='초등학교 5학년 수준 개념 설명 예시 다시 생각해 볼 질문 개인정보 안전 검토 Google 문서 저장';return estimateTokens_(fixedInstruction+'\n'+String(question||''));}
function estimatedCostUsd_(modelName,promptTokens,completionTokens){const price=AI_MODEL_PRICING_USD_PER_1M[modelName]||AI_MODEL_PRICING_USD_PER_1M.default;return (Number(promptTokens||0)*Number(price.input||0)+Number(completionTokens||0)*Number(price.output||0))/1000000;}

function logAiUsage_(entry){
  try{
    const promptTokens=tokenNumber_(entry.promptTokens,entry.prompt_tokens,0);
    const completionTokens=tokenNumber_(entry.completionTokens,entry.completion_tokens,0);
    const totalTokens=tokenNumber_(entry.totalTokens,entry.total_tokens,promptTokens+completionTokens);
    const modelName=String(entry.modelName||DEFAULT_MODEL_NAME);
    const docId=nextId_('usage');
    const log={id:docId,createdAt:nowIso_(),createdAtKst:nowKstText_(),createdAtMs:Date.now(),userId:String(entry.userId||entry.studentId||''),userRole:String(entry.userRole||entry.role||''),featureName:String(entry.featureName||entry.feature||''),modelName:modelName,prompt_tokens:promptTokens,completion_tokens:completionTokens,total_tokens:totalTokens,estimatedCostUsd:estimatedCostUsd_(modelName,promptTokens,completionTokens),error:Boolean(entry.error),errorCode:String(entry.errorCode||''),errorMessage:String(entry.errorMessage||'').slice(0,500),isEstimated:Boolean(entry.isEstimated),requestId:String(entry.requestId||''),source:'economy-ai-question-bridge-apps-script'};
    fbPatch_(AI_USAGE_PATH+'/'+docId,log);
  }catch(err){console.warn('AI usage log failed: '+(err&&err.message?err.message:err));}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
