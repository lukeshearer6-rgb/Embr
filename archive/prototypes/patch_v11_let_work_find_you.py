import sys
src,dst=sys.argv[1],sys.argv[2]
h=open(src,encoding='utf-8').read()
R=[]
def r(a,b):R.append((a,b))
# 1. Talent nav: remove "Find work"
r("['today','Today'],['jobs','Find work'],['bookings','Bookings']","['today','Today'],['bookings','Bookings']")
r("talent:['today','bookings','wallet','inbox','jobs','profile','invite']","talent:['today','bookings','wallet','inbox','profile','invite']")
r("talent:{today:vToday,jobs:vFind,bookings:vBookings","talent:{today:vToday,bookings:vBookings")
r("const r=R();const tab=S.tab[r];const un=","const r=R();let tab=S.tab[r];if(!VIEWS[r][tab]){tab=Object.keys(VIEWS[r])[0];S.tab[r]=tab;}const un=")
# 2. Today: empty state and "Jobs for you"
r("""<div class="empty">Nothing booked yet. <button class="link" data-tab="jobs">Find work</button></div>""",
  """<div class="empty">Nothing booked yet. Let work find you: brands book you straight from your profile.</div>""")
r("""'<section class="mt48"><div class="row between"><h2 class="sec">Jobs for you</h2><button class="link s" data-tab="jobs">See all jobs</button></div><div>'+(recs.length?recs.map(jobRow).join(''):'<div class="empty">No new matches today.</div>')+'</div></section></div>'+""",
  """'<section class="mt48"><h2 class="sec">Let work find you</h2><p class="measure">There\\'s nothing to apply for on Embr. Brands search for talent, and when they post a brief we show them the people who fit it. Their offer comes straight to you, with the rate, usage and dates already set.</p><p class="s g mt8 measure">Brands look at your photos, day rate and free dates, so keep them up to date.</p><div class="row wrap mt16"><button class="btn sm" data-tab="profile">Edit profile</button><button class="btn sm quiet" data-tab="profile">Update free dates</button></div></section></div>'+""")
r("const recs=S.jobs.filter(j=>j.open&&j.cat===t.cat&&!j.applicants.some(a=>a.talentId===t.id)).sort((a,b)=>(b.city===t.city)-(a.city===t.city)||b.featured-a.featured).slice(0,3);\n","")
# 3. Welcome card
r("""<b>I\\'m talent</b><div class="s g mt4">Get booked and paid</div>""","""<b>I\\'m talent</b><div class="s g mt4">Let work find you</div>""")
# 4. Job list row
r("""(R()==='talent'?(applied?'<span class="st ok">Applied</span>':plural(j.applicants.length,'applicant')):(j.open?plural(j.applicants.length,'applicant'):'Closed'))""",
  """(j.open?'<span class="st ok">Open</span>':'<span class="st off">Closed</span>')""")
r("const applied=j.applicants.some(a=>a.talentId===S.me.talent);","")
r("""+(j.featured?'<span class="tag-f">Featured</span>':'')+'</div><div class="s g mt4">'+esc(br.name)""","""+'</div><div class="s g mt4">'+esc(br.name)""")
# 5. Brand Jobs page subtitle
r("Post a brief, review who applies, and send an offer from any applicant.","Post a brief and Embr ranks the talent who fit it best. You choose who gets an offer. Talent can\\'t apply, so you only deal with people you pick.")
# 6. Job sheet: ranked matches instead of applicants; no apply form
r("const ap=j.applicants.find(a=>a.talentId===S.me.talent);\n","\n")
r("const matches=own?S.talents.filter(t=>t.cat===j.cat&&!j.applicants.some(a=>a.talentId===t.id)&&isFree(t,j.date)).sort((a,b)=>(b.city===j.city)-(a.city===j.city)||rating(b)-rating(a)).slice(0,4):[];",
  "const matches=own?S.talents.filter(t=>t.cat===j.cat&&isFree(t,j.date)&&(j.travel!=='local'||t.city===j.city)).sort((a,b)=>(b.city===j.city)-(a.city===j.city)||(Math.abs(a.rate-j.rate)-Math.abs(b.rate-j.rate))||rating(b)-rating(a)).slice(0,6):[];")
i=h.find("(own?'<h3 class=\"mt32 mb8\">Applicants</h3>'")
j=h.find("(matches.length?'<h3 class=\"mt32 mb8\">Free on '",i)
assert i>0 and j>i
R.append((h[i:j],"(own?"))
r("""(matches.length?'<h3 class="mt32 mb8">Free on '+dShort(j.date)+' and a good fit</h3>""",
  """(matches.length?'<h3 class="mt32 mb8">Best fit for this brief</h3><p class="s g mb16">Ranked by who\\'s free on '+dShort(j.date)+', where they\\'re based, day rate and reviews.</p>""")
r("""+'</div>':''):'')+'</div>'+\n   '<aside>'""","""+'</div>':'<p class="s g mt32">No one free on '+dShort(j.date)+' fits this brief yet. Try another date or search the board.</p>'):'')+'</div>'+\n   '<aside>'""")
i=h.find("'<aside>'+(r==='talent'?(ap?")
j=h.find("(own?'<div class=\"stack\"><button class=\"btn full\" data-a=\"feature\"",i)
assert i>0 and j>i
R.append((h[i:j],"'<aside>'+"))
r("""(own?'<div class="stack"><button class="btn full" data-a="feature" data-id="'+j.id+'" '+(j.featured?'disabled':'')+'>'+(j.featured?'Featured':'Feature this job')+'</button><p class="xs g">Featured jobs appear first and go to matching talent. Price to be set.</p><button class="btn quiet full\"""",
  """(own?'<div class="stack"><button class="btn quiet full\"""")
r("""<label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="feature"> Feature this job</label>""","")
# 7. Posting a job: no job alerts to talent
i=h.find("notify('talent','New job: ")
j=h.find("S.tab.brand='jobs'",i)
assert i>0 and j>i
R.append((h[i:j],"save();toast('Job published. Here are the people who fit it best.');"))
# 8. Pro plan and ops notes no longer mention featured jobs
r("Embr Pro: featured jobs, advanced search and campaign reporting.","Embr Pro: advanced search and campaign reporting.")
r("Pro and featured-job pricing.","Pro pricing.")
# 9. Wallet membership: say what it pays for
r("""<dt>Commission</dt><dd>0% on everything you earn</dd>'+(t.member?""","""<dt>Covers</dt><dd>Usage tracking, payment protection, invoices and statements, your Book-me page</dd><dt>Commission</dt><dd>0% on everything you earn</dd>'+(t.member?""")
for a,b in R:
    n=h.count(a)
    if n!=1: print('COUNT',n,repr(a[:120]));sys.exit(1)
    h=h.replace(a,b)
open(dst,'w',encoding='utf-8').write(h)
print('ok',len(R))
