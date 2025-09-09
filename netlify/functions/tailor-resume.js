// netlify/functions/tailor-resume.js
// Uses Gemini REST API to avoid heavy SDK; key stays on the server.

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-1.5-flash';

export const handler = async (event) => {
  try{
    if(!API_KEY) return resp(500,{success:false,error:'Server missing GEMINI_API_KEY'});
    const { jobInput, inputType } = JSON.parse(event.body||'{}');
    if(!jobInput) return resp(400,{success:false,error:'missing job input'});

    let jobText = jobInput;
    if(inputType==='url'){
      // fetch description server-side if URL mode was used
      const r = await fetch(`${process.env.URL || ''}/.netlify/functions/scrape`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: jobInput })});
      const d = await r.json(); jobText = d?.data?.description || jobInput;
    }

    const sys = `You are a concise resume tailor. Given a job description, rewrite the user's resume content to highlight matching skills, using clean bullet points and a short summary. Keep to ~1 page.`;
    const user = `Job description:\n\n${jobText}\n\nReturn only the tailored resume text.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{ role:'user', parts:[{text: `${sys}\n\n${user}`}] }] })
    });
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return resp(200,{ success:true, tailoredResume: text.trim() });
  }catch(err){
    console.error(err); return resp(500,{success:false,error:'gemini failed'});
  }
};

const resp = (status, json)=>({ statusCode:status, headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(json) });