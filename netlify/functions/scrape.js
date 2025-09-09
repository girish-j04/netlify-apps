// netlify/functions/scrape.js
import * as cheerio from 'cheerio';

export const handler = async (event) => {
  try{
    const { url } = JSON.parse(event.body||'{}');
    if(!url) return resp(400,{error:'missing url'});
    const r = await fetch(url, { headers:{ 'User-Agent':'Mozilla/5.0' }});
    const html = await r.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || $('title').text().trim();
    const company = $('[data-company], .company, .jobs-company, a[href*="/company"], [itemprop="hiringOrganization"]').first().text().trim() || $('meta[name="company"]').attr('content') || '';
    const jobId = ($('[id*="job" i], [data-job-id], [data-jobid]').attr('data-job-id') || $('[data-job-id]').attr('data-job-id') || $('[data-jobid]').attr('data-jobid') || '').toString();

    // best-effort description
    const desc = $('meta[property="og:description"]').attr('content')
      || $('[itemprop="description"]').text().trim()
      || $('section, article, .description, #job-details').first().text().trim().slice(0, 2000);

    return resp(200, { success:true, data:{ title, company, jobId, description: desc, url } });
  }catch(err){
    console.error(err);
    return resp(500, { success:false, error:'scrape failed' });
  }
};

const resp = (status, json)=>({ statusCode:status, headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(json) });