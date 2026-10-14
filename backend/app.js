/* CVSmart front-end. Previous version is kept in previous_version/. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = localStorage.cvLang || 'ar', chosen = null, result = null, hrFiles = [], hrResult = null, svcCurrent = 0, catalog = null;
const L = (ar, en) => lang === 'ar' ? ar : (en ?? ar);

/* ------------------------------------------------------------------ static data (kept from earlier versions) */
const TRAINING_PLATFORMS = [
  ['دروب', 'برامج تدريب وتطوير مهني', 'https://doroob.sa/', '🎓'], ['إدراك', 'دورات عربية مفتوحة', 'https://www.edraak.org/', '📘'],
  ['أكاديمية طويق', 'معسكرات تقنية احترافية', 'https://tuwaiq.edu.sa/', '💻'], ['Microsoft Learn', 'مسارات وشهادات تقنية', 'https://learn.microsoft.com/training/', '▣'],
  ['LinkedIn Learning', 'تعلم مهني مرتبط بسوق العمل', 'https://www.linkedin.com/learning/', 'in']];
const PROGRAMS = [
  ['سدايا — أكاديمية البيانات والذكاء الاصطناعي', 'برامج ومعسكرات في البيانات والذكاء الاصطناعي', 'https://sdaia.gov.sa/', '◉', ['منصة أذكى إكس للتسجيل', 'https://athkax.sdaia.gov.sa']],
  ['أكاديمية طويق', 'معسكرات تقنية احترافية في البرمجة والبيانات والأمن', 'https://tuwaiq.edu.sa/', '◉'],
  ['سيسكو — Cisco Networking Academy', 'تدريب الشبكات والأمن السيبراني', 'https://www.netacad.com/', '◉', ['Cisco Skills for All (مجاني)', 'https://skillsforall.com/']],
  ['دروب — الأكاديمية الوطنية للتدريب', 'دورات إلكترونية وبرامج تأهيل لسوق العمل', 'https://doroob.sa/', '◉']];
/* To add a job platform, add one line here: [name, description, link] */
const JOB_SITES = [
  ['LinkedIn Jobs', 'وظائف بحسب المسمى والمهارات', 'https://www.linkedin.com/jobs/'], ['جدارات', 'المنصة الوطنية الموحدة للتوظيف', 'https://jadarat.sa/'],
  ['Bayt.com', 'وظائف في المنطقة العربية', 'https://www.bayt.com/ar/saudi-arabia/'], ['صبار', 'منصة توظيف سعودية', 'https://sabbar.com/'],
  ['Indeed', 'البحث عن وظائف', 'https://sa.indeed.com/'], ['وظيفتك علينا', 'تجميع الوظائف الحكومية والخاصة', 'https://www.wdeftksa.com/sa'],
  ['Tanqeeb', 'وظائف في الخليج والشرق الأوسط', 'https://www.tanqeeb.com/']];
/* To add a course site, add one line here: [name, description, link] */
const COURSE_SITES = [
  ['سدايا — أكاديمية البيانات والذكاء الاصطناعي', 'برامج ومعسكرات وتسجيل عبر أذكى إكس', 'https://athkax.sdaia.gov.sa'],
  ['أكاديمية طويق', 'معسكرات تقنية احترافية', 'https://tuwaiq.edu.sa/'],
  ['سيسكو — Networking Academy', 'الشبكات والأمن السيبراني', 'https://www.netacad.com/'],
  ['دروب', 'تدريب وتأهيل لسوق العمل', 'https://doroob.sa/'],
  ['إدراك', 'دورات عربية مفتوحة', 'https://www.edraak.org/'],
  ['Coursera', 'دورات وشهادات من جامعات وشركات', 'https://www.coursera.org/'],
  ['Udemy', 'دورات عملية في كل المجالات', 'https://www.udemy.com/'],
  ['Microsoft Learn', 'مسارات وشهادات تقنية', 'https://learn.microsoft.com/training/'],
  ['LinkedIn Learning', 'تعلّم مهني مرتبط بسوق العمل', 'https://www.linkedin.com/learning/']];
function tiles(items) {
  return items.map(x => `<a class="tile" href="${esc(x[2])}" target="_blank" rel="noopener"><i>${esc([...x[0].replace(/^[^A-Za-z\u0600-\u06FF]+/, '')][0] || '↗')}</i><span><b>${esc(x[0])}</b><small>${esc(x[1])}</small></span></a>`).join('');
}
const DEFAULT_COURSES = [
  ['تحليل البيانات باستخدام Python', 'Coursera / IBM', 'https://www.coursera.org/learn/python-for-applied-data-science-ai'],
  ['Power BI المتقدم', 'Microsoft Learn', 'https://learn.microsoft.com/training/paths/get-started-power-bi/'],
  ['أساسيات تعلم الآلة', 'Google', 'https://developers.google.com/machine-learning/crash-course'],
  ['Google Data Analytics', 'Google / Coursera', 'https://www.coursera.org/professional-certificates/google-data-analytics'],
  ['Microsoft PL-300', 'Microsoft', 'https://learn.microsoft.com/credentials/certifications/power-bi-data-analyst-associate/'],
  ['Tableau Certified Data Analyst', 'Tableau', 'https://www.tableau.com/learn/certification/data-analyst']];
const DEFAULT_CERTS = DEFAULT_COURSES.slice(3).map(c => ({ name: c[0], issuer: c[1], url: c[2], cost: 'راجع الموقع الرسمي' }));

const SERVICES = [
  { key: 'analysis', icon: '↑', ar: 'تحليل السيرة الذاتية', en: 'Resume analysis', d: 'ارفع PDF أو DOCX واحصل على قراءة فورية لمحتواك.' },
  { key: 'courses', icon: '✦', ar: 'دورات تقوية', en: 'Skill-building courses', d: 'خطة تعلم مبنية على الفجوات الحقيقية في سيرتك.' },
  { key: 'jobs', icon: '⌁', ar: 'الوظائف المطابقة', en: 'Matching jobs', d: 'اكتشف المسميات والوظائف الأقرب إلى خبرتك.' },
  { key: 'certs', icon: '♢', ar: 'شهادات احترافية', en: 'Professional certificates', d: 'الشهادات التي تقوّي سيرتك بحسب تخصصك، مع الموقع الرسمي والتكلفة.' },
  { key: 'platforms', icon: '◎', ar: 'منصات التدريب', en: 'Learning platforms', d: 'روابط مباشرة إلى أفضل مصادر التطوير المهني.' },
  { key: 'programs', icon: '◉', ar: 'البرامج التدريبية', en: 'Training programs', d: 'برامج سدايا وطويق وسيسكو ودروب مع روابطها الرسمية.' },
  { key: 'improved', icon: '▤', ar: 'سيرة محسنة', en: 'Improved resume', d: 'نزّل نسخة منظمة من سيرتك مع اقتراحات عملية.' },
  { key: 'role', icon: '◈', ar: 'المسمى الأنسب', en: 'Best-fit title', d: 'اعرف كيف تقدم نفسك للسوق بثقة ووضوح.' },
  { key: 'companies', icon: '⌂', ar: 'الشركات والفرص', en: 'Companies & jobs', d: 'منصات التوظيف: LinkedIn وجدارات وBayt.com وصبار وغيرها.' },
  { key: 'report', icon: '❏', ar: 'تقرير التحليل (PDF)', en: 'Analysis report (PDF)', d: 'تقرير واضح بلغة بسيطة تحفظه كملف PDF وتستفيد منه في بحثك.' },
  { key: 'hr', icon: '⚑', ar: 'فرز السير الذاتية (HR)', en: 'CV screening (HR)', d: 'ارفع حتى 10 سير، اكتب المسمى والخبرة المطلوبة، ونرتّب لك الأنسب.' }];

/* ------------------------------------------------------------------ language / theme */
function setLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  $$('[data-ar]').forEach(e => { e.innerHTML = e.dataset[lang] ?? e.dataset.ar; });
  $$('[data-ph-ar]').forEach(e => { e.placeholder = e.dataset[lang === 'ar' ? 'phAr' : 'phEn']; });
  $('#langToggle').textContent = lang === 'ar' ? 'EN' : 'عربي';
}
function syncTheme() {
  const light = document.body.classList.contains('light');
  $('#themeToggle').textContent = light ? '☾' : '☀'; $('#themeToggle').title = light ? 'الوضع الكحلي' : 'الوضع الفاتح';
}
$('#themeToggle').onclick = () => { document.body.classList.toggle('light'); localStorage.cvTheme = document.body.classList.contains('light') ? 'light' : 'navy'; syncTheme(); };
if (localStorage.cvTheme === 'light') document.body.classList.add('light');
$('#langToggle').onclick = () => {
  lang = lang === 'ar' ? 'en' : 'ar'; localStorage.cvLang = lang; setLang(); renderServices(); refreshAuth();
  if (result) renderDashboard(); if (hrResult) renderHr(); renderCertSection();
};

/* ------------------------------------------------------------------ services list + panel */
function renderServices() {
  $('#serviceGrid').innerHTML = SERVICES.map((s, i) => `<button type="button" class="service${i === svcCurrent ? ' active' : ''}" data-i="${i}" aria-expanded="${i === svcCurrent}"><span class="icon">${s.icon}</span><h3>${L(s.ar, s.en)}</h3><span class="arrow">‹</span></button>`).join('');
  $$('#serviceGrid .service').forEach(b => b.onclick = () => showService(+b.dataset.i, true));
  showService(svcCurrent, false);
}
const note = () => `<div class="svc-note"><p>${L('ارفع سيرتك أولًا لتظهر لك نتيجة هذا القسم.', 'Upload your resume first to see this section.')}</p><a class="btn primary" href="#analyzer">${L('ارفع سيرتك', 'Upload resume')}</a></div>`;
const chips = a => `<div class="chips">${a.map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
const ext = items => `<div>${items.map(x => `<a class="external" href="${esc(x[2])}" target="_blank" rel="noopener"><i>${esc(x[3] || '↗')}</i><span><b>${esc(x[0])}</b><small>${esc(x[1])}</small>${x[4] ? `<small class="extra-link" data-href="${esc(x[4][1])}">${esc(x[4][0])} ↗</small>` : ''}</span><em>↗</em></a>`).join('')}</div>`;
const certCard = c => `<a class="external cert" href="${esc(c.url)}" target="_blank" rel="noopener"><i>♢</i><span><b>${esc(c.name)}</b><small>${esc(c.issuer)} · ${L('التكلفة', 'Cost')}: ${esc(c.cost)}</small>${c.reason ? `<small>${esc(c.reason)}</small>` : ''}</span><em>↗</em></a>`;
const certNote = '<p class="fine">التكاليف تقريبية وقد تتغير، والروابط تُراجع من حين لآخر؛ تأكد من الموقع الرسمي قبل التسجيل.</p>';

function showService(i, scrollIt) {
  svcCurrent = i; const s = SERVICES[i], has = !!result, panel = $('#servicePanel'); if (!panel) return;
  $$('#serviceGrid .service').forEach((b, k) => { b.classList.toggle('active', k === i); b.setAttribute('aria-expanded', k === i); });
  let body = '';
  switch (s.key) {
    case 'analysis':
      body = has ? `<div class="svc-score"><strong>${esc(result.score)}%</strong><span>${L('قوة السيرة', 'Resume strength')}</span></div>
        <h4>${L('فحص السيرة', 'Resume check')}</h4><ul class="check">${(result.checklist || []).map(c => `<li class="${c.ok ? 'ok' : 'no'}">${esc(c.label)}</li>`).join('')}</ul>
        <h4>${L('المهارات الموجودة', 'Skills found')}</h4>${chips(result.skills)}<h4>${L('المهارات الناقصة', 'Skills to build')}</h4><div class="missing">${chips(result.missing)}</div>` : note(); break;
    case 'courses':
      body = has ? (result.courses.length ? result.courses.map(c => `<div class="course"><b>${esc(c.skill)}</b><div class="links">${c.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join('')}</div></div>`).join('') : `<p class="fine">${L('لا توجد فجوات واضحة في مهاراتك لهذا المسمى.', 'No clear skill gaps for this title.')}</p>`)
        : `<p class="fine">${L('دورات عامة مقترحة — ارفع سيرتك لتخصيصها لك.', 'General courses — upload your resume to personalize them.')}</p>${ext(DEFAULT_COURSES)}`; break;
    case 'jobs':
      body = has ? (result.jobs.length ? `<div class="jobs">${result.jobs.map(j => `<div class="job"><b>${esc(L(j.ar, j.en))}</b><small>${esc(j.sector)}</small><strong>${esc(j.match)}%</strong></div>`).join('')}</div>` : `<p class="fine">${esc(result.tips[0] || '')}</p>`) : note(); break;
    case 'certs':
      if (has) body = (result.certs.length ? result.certs.map(certCard).join('') : `<p class="fine">${L('حدّد التخصص بوضوح في السيرة لنقترح شهادات مناسبة.', 'State your specialty clearly to get certificate suggestions.')}</p>`)
        + (result.certs_have.length ? `<h4>${L('شهادات ذُكرت في سيرتك', 'Already in your resume')}</h4>${chips(result.certs_have.map(c => c.name))}` : '') + certNote;
      else {
        const fields = catalog ? Object.keys(catalog.certs) : [];
        body = `<p class="fine">${L('تصفّح الشهادات بحسب المجال، أو ارفع سيرتك لنحدد لك الأنسب.', 'Browse by field, or upload your resume for tailored picks.')}</p>`
          + (fields.length ? `<select id="certField" class="field-select">${fields.map(f => `<option>${esc(f)}</option>`).join('')}</select><div id="certList">${catalog.certs[fields[0]].map(certCard).join('')}</div>` : DEFAULT_CERTS.map(certCard).join('')) + certNote;
      } break;
    case 'platforms': body = ext(TRAINING_PLATFORMS); break;
    case 'programs': body = ext(PROGRAMS) + `<p class="fine">${L('الروابط تفتح الموقع الرسمي لكل جهة في نافذة جديدة.', 'Links open each official site in a new tab.')}</p>`; break;
    case 'improved': body = has ? `<pre class="svc-pre">${esc(result.improved)}</pre><button class="btn primary" type="button" id="svcDownload">${L('تنزيل السيرة ↓', 'Download resume ↓')}</button>` : note(); break;
    case 'role': body = has ? `<div class="svc-score"><strong class="role-name">${esc(L(result.role_ar, result.role_en))}</strong></div>
        <p class="fine">${L('القطاع', 'Sector')}: ${esc(result.sector || '—')} · ${L('المستوى', 'Level')}: ${esc(L(result.level_ar, result.level_en))} · ${L('الخبرة', 'Experience')}: ${esc(result.years)} ${L('سنة', 'yrs')}${result.education ? ' · ' + esc(result.education) : ''}</p>
        ${result.confidence === 'low' ? `<p class="fine">${L('النتيجة تقريبية: اذكر مسماك ومهاراتك بوضوح أكثر في السيرة.', 'Approximate result: describe your title and skills more clearly.')}</p>` : ''}` : note(); break;
    case 'companies': body = ext(JOB_SITES.map(x => [x[0], x[1], x[2], '↗'])); break;
    case 'report': body = has ? `<p class="fine">${L('التقرير يشمل: قوة السيرة، المسمى الأنسب، الوظائف المطابقة، المهارات، الشهادات المقترحة، البرامج التدريبية، منصات التوظيف، ونصائح التحسين — بلغة بسيطة وبدون أي أكواد.', 'The report covers your score, best-fit title, matching jobs, skills, suggested certificates, training programs, job platforms and tips — in plain language.')}</p><button class="btn primary" type="button" id="svcReport">${L('تنزيل التقرير PDF ↓', 'Download PDF report ↓')}</button><p class="fine">${L('من نافذة الطباعة اختر «حفظ بصيغة PDF».', 'In the print window choose “Save as PDF”.')}</p>` : note(); break;
    case 'hr': body = `<p class="fine">${esc(s.d)}</p><a class="btn primary" href="#hr">${L('انتقل إلى نموذج الفرز', 'Go to the screening form')}</a>`
      + (hrResult ? `<h4>${L('آخر نتيجة فرز', 'Latest screening')}</h4>${hrResult.results.slice(0, 3).map(r => `<div class="job"><b>${r.rank}. ${esc(r.name)}</b><small>${esc(r.verdict)} · ${esc(r.experience_note)}</small><strong>${esc(r.score)}%</strong></div>`).join('')}` : ''); break;
  }
  panel.innerHTML = `<div class="svc-head"><span class="icon">${s.icon}</span><div><h2>${L(s.ar, s.en)}</h2><p>${esc(s.d)}</p></div></div><div class="svc-body">${body}</div>`;
  $$('#servicePanel .extra-link').forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); window.open(a.dataset.href, '_blank', 'noopener'); });
  if ($('#certField')) $('#certField').onchange = e => { $('#certList').innerHTML = catalog.certs[e.target.value].map(certCard).join(''); };
  if ($('#svcDownload')) $('#svcDownload').onclick = downloadImproved;
  if ($('#svcReport')) $('#svcReport').onclick = openReport;
  if (scrollIt && innerWidth <= 850) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ certificates section */
const certGo = c => `<article class="cert-card${c.reason ? ' pick' : ''}"><i>♢</i><div><b>${esc(c.name)}</b><small>${esc(c.issuer)} · ${L('التكلفة التقريبية', 'Approx. cost')}: ${esc(c.cost)}</small>${c.reason ? `<small>${esc(c.reason)}</small>` : ''}<a class="go" href="${esc(c.url)}" target="_blank" rel="noopener">${L('الذهاب إلى موقع الشهادة ↗', 'Go to the certificate site ↗')}</a></div></article>`;
function renderCertSection() {
  const sel = $('#certField2'); if (!sel) return;
  if (catalog && !sel.options.length) { sel.innerHTML = Object.keys(catalog.certs).map(f => `<option>${esc(f)}</option>`).join(''); sel.onchange = renderCertSection; }
  const hint = $('#certHint'), grid = $('#certGrid');
  if (result && result.certs.length && !sel.dataset.manual) {
    hint.textContent = L(`مقترحة لسيرتك (${result.role_ar}) — يمكنك أيضًا تصفح باقي التخصصات من القائمة.`, 'Suggested for your CV — you can also browse other fields.');
    grid.innerHTML = result.certs.map(certGo).join(''); if (result.sector && [...sel.options].some(o => o.value === result.sector)) sel.value = result.sector; return;
  }
  hint.textContent = L('تصفّح الشهادات بحسب المجال، أو ارفع سيرتك لتظهر لك الأنسب.', 'Browse by field, or upload your CV for tailored picks.');
  grid.innerHTML = catalog && sel.value ? catalog.certs[sel.value].map(certGo).join('') : DEFAULT_CERTS.map(certGo).join('');
}
$('#certField2').addEventListener('change', e => { e.target.dataset.manual = '1'; renderCertSection(); });

/* ------------------------------------------------------------------ dashboard (job seeker) */
function renderDashboard() {
  const d = result, ar = lang === 'ar';
  $('#score').textContent = d.score + '%'; $('#role').textContent = ar ? d.role_ar : d.role_en;
  $('#roleText').textContent = ar ? 'المسار الأقرب إلى المهارات المكتشفة في سيرتك.' : 'The closest path to the skills found in your resume.';
  $('#found').innerHTML = d.skills.map(x => `<span>${esc(x)}</span>`).join(''); $('#missing').innerHTML = d.missing.map(x => `<span>${esc(x)}</span>`).join('');
  $('#skillCount').textContent = d.skills.length; $('#missingCount').textContent = d.missing.length;
  $('#jobs').innerHTML = d.jobs.map(j => `<div class="job"><b>${esc(ar ? j.ar : j.en)}</b><small>${esc(ar ? j.en : j.ar)}</small><strong>${esc(j.match)}%</strong></div>`).join('');
  $('#courses').innerHTML = d.courses.length ? d.courses.map(c => `<div class="course"><b>${esc(c.skill)}</b><div class="links">${c.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join('')}</div></div>`).join('') : `<p class="fine">${ar ? 'لا توجد فجوات واضحة.' : 'No clear gaps.'}</p>`;
  $('#resourcesList').innerHTML = ext(TRAINING_PLATFORMS);
  $('#companies').innerHTML = JOB_SITES.map(x => `<a class="company" href="${esc(x[2])}" target="_blank" rel="noopener"><b>${esc(x[0])} ↗</b><small>${esc(x[1])}</small></a>`).join('');
  $('#improved').textContent = d.improved;
  $('#tips').innerHTML = d.tips.map(x => `<div class="tip">${esc(x)}</div>`).join('');
  $('#modeBadge').textContent = ar ? 'تحليل فعلي' : 'Live analysis';
  let panel = $('#nextActions');
  if (!panel) { panel = document.createElement('section'); panel.id = 'nextActions'; panel.className = 'analysis-actions'; $('#dashboard').insertBefore(panel, $('#dashboard').querySelector('.score-row')); }
  panel.innerHTML = [['read', '⌕', ar ? 'قراءة تحليل السيرة' : 'Read resume analysis', ar ? 'افهم نقاط القوة والنتيجة' : 'Understand your score and strengths'],
    ['improve', '✦', ar ? 'تحسين وتقوية السيرة' : 'Improve your resume', ar ? 'صياغة أوضح وخطوات عملية' : 'Clearer wording and practical steps'],
    ['gaps', '!', ar ? 'إرشاد النواقص' : 'Skill gap guidance', ar ? 'المهارات التي تحتاج إلى تطوير' : 'Skills that need development'],
    ['tips', '✓', ar ? 'نصائح التحليل' : 'Analysis tips', ar ? 'إرشادات تعديل السيرة' : 'Guidance to edit your resume']]
    .map(a => `<button class="analysis-action" data-action="${a[0]}"><i>${a[1]}</i><b>${a[2]}</b><small>${a[3]}</small></button>`).join('');
  panel.querySelectorAll('[data-action]').forEach(b => b.onclick = () => $({ read: '#role', improve: '#improved', gaps: '#missing', tips: '#tips' }[b.dataset.action])?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  $('#dashboard').hidden = false; $('#dashboard').scrollIntoView({ behavior: 'smooth' });
}
function downloadImproved() {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([result.improved], { type: 'text/plain;charset=utf-8' }));
  a.download = 'CVSmart_Improved_Resume.txt'; a.click(); URL.revokeObjectURL(a.href);
}
$('#download').onclick = () => { if (result) downloadImproved(); };

/* ------------------------------------------------------------------ upload helpers */
async function postForm(url, fd) {
  let r;
  try { r = await fetch(url, { method: 'POST', body: fd }); } catch { throw Error(L('تعذّر الاتصال بخادم التحليل. تأكد أن الخادم يعمل.', 'Could not reach the analysis server.')); }
  let j = null; try { j = await r.json(); } catch { /* not json */ }
  if (!r.ok || !j || j.ok === false) throw Error((j && j.error) || L('حدث خطأ أثناء المعالجة.', 'Something went wrong.'));
  return j;
}
function bindDrop(zone, input, onFiles) {
  ['dragenter', 'dragover'].forEach(n => zone.addEventListener(n, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(n => zone.addEventListener(n, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => onFiles([...e.dataTransfer.files]));
  input.onchange = () => onFiles([...input.files]);
}
const okExt = n => /\.(pdf|docx|doc|txt|jpg|jpeg|png|webp|bmp|tif|tiff)$/i.test(n);

/* single resume */
bindDrop($('#dropZone'), $('#resumeFile'), files => { chosen = files[0] || null; $('#fileName').textContent = chosen ? chosen.name : ''; });
$('#uploadForm').onsubmit = async e => {
  e.preventDefault(); const st = $('#status');
  if (!chosen) { st.textContent = L('اختر ملف السيرة أولًا.', 'Choose a resume file first.'); return; }
  if (chosen.size > 10 * 1024 * 1024) { st.textContent = L('حجم الملف يتجاوز 10MB.', 'File is larger than 10MB.'); return; }
  if (!okExt(chosen.name)) { st.textContent = L('الصيغة غير مدعومة. استخدم PDF أو DOCX أو TXT أو صورة.', 'Unsupported format.'); return; }
  st.textContent = L('جاري قراءة السيرة وتحليلها...', 'Reading and analyzing your resume...');
  const bt = $('#uploadForm button[type=submit]'); bt.disabled = true;
  try {
    const fd = new FormData(); fd.append('cv', chosen); result = await postForm('/api/analyze', fd);
    delete $('#certField2').dataset.manual; renderDashboard(); showService(svcCurrent, false); renderCertSection(); st.textContent = L('اكتمل التحليل حسب محتوى السيرة.', 'Analysis completed.');
  } catch (err) { st.textContent = err.message; } finally { bt.disabled = false; }
};

/* HR: up to 10 CVs */
const setHrFiles = files => {
  hrFiles = files.filter(f => okExt(f.name)).slice(0, 10);
  $('#hrCount').textContent = hrFiles.length ? L(`${hrFiles.length} من 10 سير محددة`, `${hrFiles.length} of 10 CVs selected`) : '';
  $('#hrNames').textContent = hrFiles.map(f => f.name).join(' • ');
  $('#hrStatus').textContent = files.length > 10 ? L('تم أخذ أول 10 ملفات فقط.', 'Only the first 10 files were taken.') : '';
};
bindDrop($('#hrDrop'), $('#hrFiles'), setHrFiles);
$('#hrForm').onsubmit = async e => {
  e.preventDefault(); const st = $('#hrStatus'), title = $('#hrTitle').value.trim();
  if (!hrFiles.length) { st.textContent = L('ارفع سيرة ذاتية واحدة على الأقل.', 'Upload at least one CV.'); return; }
  if (!title) { st.textContent = L('اكتب المسمى الوظيفي المطلوب.', 'Enter the required job title.'); return; }
  st.textContent = L('جاري قراءة السير وفرزها...', 'Reading and ranking the CVs...');
  const hb = $('#hrForm button[type=submit]'); hb.disabled = true;
  try {
    const fd = new FormData(); hrFiles.forEach(f => fd.append('cvs', f)); fd.append('title', title); fd.append('years', $('#hrYears').value || '0');
    hrResult = await postForm('/api/hr/screen', fd); renderHr(); showService(svcCurrent, false);
    st.textContent = L('تم الفرز.', 'Screening done.');
  } catch (err) { st.textContent = err.message; } finally { hb.disabled = false; }
};
function renderHr() {
  const r = hrResult, box = $('#hrResults'), ar = lang === 'ar';
  box.innerHTML = `<div class="hr-head"><div><h3>${L('نتيجة الفرز', 'Screening result')}</h3><p class="fine">${L('المسمى المطلوب', 'Required title')}: <b>${esc(r.title)}</b>${r.matched_role ? ` (${esc(ar ? r.matched_role.ar : r.matched_role.en)} — ${esc(r.matched_role.sector)})` : ''} · ${L('الخبرة المطلوبة', 'Required experience')}: <b>${esc(r.required_years)}</b> ${L('سنة', 'yrs')} · ${L('عدد السير', 'CVs')}: <b>${esc(r.total)}</b></p></div><button class="btn dark" id="hrCsv" type="button">${L('تنزيل النتائج CSV ↓', 'Download CSV ↓')}</button></div>`
    + r.results.map(x => `<article class="hr-card ${esc(x.verdict_class)}"><div class="hr-rank">${x.rank}</div><div class="hr-main"><h3>${esc(x.name)} <small>${esc(x.file)}</small></h3>
      <p class="fine">${x.suggested_title ? L('المسمى الأقرب لسيرته', 'Closest title') + ': ' + esc(x.suggested_title) : ''}${x.education ? ' · ' + esc(x.education) : ''}</p>
      ${x.matched.length ? chips(x.matched) : ''}<p class="fine">${[x.email, x.phone].filter(Boolean).map(esc).join(' · ')}</p></div>
      <div class="hr-side"><strong class="hr-score">${esc(x.score)}%</strong><span class="verdict ${esc(x.verdict_class)}">${esc(x.verdict)}</span><small class="${x.meets_experience ? 'okx' : 'nox'}">${esc(x.experience_note)}</small></div></article>`).join('')
    + (r.errors.length ? `<p class="fine">${r.errors.map(e => esc(e.file) + ': ' + esc(e.error)).join('<br>')}</p>` : '');
  box.hidden = false; $('#hrCsv').onclick = hrCsv; box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function hrCsv() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', rows = [['الترتيب', 'الاسم', 'الملف', 'نسبة الملاءمة', 'التقييم', 'سنوات الخبرة', 'المؤهل', 'المسمى الأقرب', 'البريد', 'الجوال']]
    .concat(hrResult.results.map(x => [x.rank, x.name, x.file, x.score + '%', x.verdict, x.years, x.education, x.suggested_title, x.email, x.phone]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'CVSmart_HR_Ranking.csv'; a.click(); URL.revokeObjectURL(a.href);
}

/* ------------------------------------------------------------------ PDF report (print to PDF, plain language) */
function buildReport() {
  const d = result, date = new Date().toLocaleDateString('ar-SA'), host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const li = a => a.map(x => `<li>${esc(x)}</li>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>CVSmart — تقرير تحليل السيرة الذاتية</title><style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0a1a33;line-height:1.7;font-size:13px;margin:0}
.bar{background:#0a1a33;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-radius:10px;margin-bottom:16px}.bar b{font-size:20px}.bar b i{font-style:normal;background:#2bd37f;color:#06182f;padding:1px 7px;border-radius:7px;font-size:13px;margin-inline-end:6px}
.noprint{background:#e9f9f1;border:1px solid #2bd37f;border-radius:8px;padding:10px 14px;margin-bottom:14px}.noprint button{background:#2bd37f;border:0;border-radius:7px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer;margin-inline-start:10px}
h2{font-size:16px;border-inline-start:4px solid #2bd37f;padding-inline-start:9px;margin:20px 0 8px}section{break-inside:avoid}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.card{border:1px solid #d8e2f0;border-radius:9px;padding:10px 12px}.card small{display:block;color:#5a6d8c;font-size:11px}.card strong{font-size:18px}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #d8e2f0;padding:6px 8px;text-align:start;vertical-align:top}th{background:#f1f5fb}
.chips span{display:inline-block;background:#e9f9f1;border-radius:6px;padding:2px 8px;margin:2px;font-size:12px}.miss span{background:#fff1df}
ul{margin:4px 0;padding-inline-start:20px}.ok{color:#0e8a4f}.no{color:#b9770e}.fine{color:#5a6d8c;font-size:11px}
@media print{.noprint{display:none}}</style></head><body>
<div class="bar"><b><i>CV</i>Smart</b><span>تقرير تحليل السيرة الذاتية · ${esc(date)}</span></div>
<div class="noprint">لحفظ التقرير كملف PDF اختر «حفظ بصيغة PDF» من نافذة الطباعة. <button onclick="print()">طباعة / حفظ PDF</button></div>
<section class="grid"><div class="card"><small>قوة السيرة</small><strong>${esc(d.score)} / 100</strong></div><div class="card"><small>المسمى الأنسب</small><strong>${esc(d.role_ar)}</strong></div><div class="card"><small>المستوى والخبرة</small><strong>${esc(d.level_ar)} · ${esc(d.years)} سنة</strong></div></section>
<section><h2>الوظائف المناسبة لك</h2>${d.jobs.length ? `<table><tr><th>المسمى الوظيفي</th><th>القطاع</th><th>نسبة المطابقة</th></tr>${d.jobs.map(j => `<tr><td>${esc(j.ar)} (${esc(j.en)})</td><td>${esc(j.sector)}</td><td>${esc(j.match)}%</td></tr>`).join('')}</table>` : '<p>لم نتمكن من تحديد تخصصك بدقة؛ اذكر مسماك الوظيفي ومهاراتك بوضوح في السيرة ثم أعد التحليل.</p>'}</section>
<section><h2>نقاط قوتك</h2><div class="chips">${d.skills.map(s => `<span>${esc(s)}</span>`).join('') || 'لم تُكتشف مهارات واضحة.'}</div></section>
<section><h2>ما ينقص سيرتك</h2><div class="chips miss">${d.missing.map(s => `<span>${esc(s)}</span>`).join('') || 'لا توجد فجوات واضحة.'}</div>${d.courses.length ? `<p class="fine">للتعلم: ابحث عن هذه المهارات في منصات ${['Coursera', 'Udemy', 'Microsoft Learn', 'دروب', 'إدراك'].join('، ')}.</p>` : ''}</section>
<section><h2>فحص السيرة</h2><ul>${d.checklist.map(c => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${esc(c.label)}</li>`).join('')}</ul></section>
<section><h2>شهادات احترافية مقترحة</h2>${d.certs.length ? `<table><tr><th>الشهادة</th><th>الجهة</th><th>التكلفة التقريبية</th><th>الموقع</th></tr>${d.certs.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.issuer)}</td><td>${esc(c.cost)}</td><td>${esc(host(c.url))}</td></tr>`).join('')}</table><p class="fine">التكاليف تقريبية وقد تتغير؛ تأكد من الموقع الرسمي قبل التسجيل.</p>` : '<p>حدّد تخصصك بوضوح في السيرة لتظهر لك شهادات مناسبة.</p>'}</section>
<section><h2>برامج تدريبية</h2><ul>${PROGRAMS.map(p => `<li>${esc(p[0])} — ${esc(host(p[2]))}</li>`).join('')}</ul></section>
<section><h2>منصات التوظيف</h2><ul>${JOB_SITES.map(p => `<li>${esc(p[0])} — ${esc(host(p[2]))}</li>`).join('')}</ul></section>
<section><h2>نصائح لتحسين سيرتك</h2><ul>${li(d.tips)}</ul></section>
<p class="fine">التقرير إرشادي، ودرجة السيرة مؤشر لمساعدتك على التحسين وليست ضمانًا للحصول على وظيفة. CVSmart</p></body></html>`;
}
function openReport() {
  if (!result) return; const html = buildReport(), w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch { /* user can use the button */ } }, 500); return; }
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 400);
}

/* ------------------------------------------------------------------ local account (kept from earlier versions) */
const authStyle = document.createElement('style');
authStyle.textContent = '.auth-link{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:8px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.auth-backdrop{position:fixed;inset:0;background:#040d1ccc;display:grid;place-items:center;z-index:20;padding:18px}.auth-modal{background:var(--surface);color:var(--ink);width:min(390px,100%);border-radius:14px;padding:25px;box-shadow:0 25px 70px #0005}.auth-modal h2{margin:0 0 5px}.auth-modal p{color:var(--muted);font-size:12px}.auth-modal input{display:block;width:100%;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:7px;padding:11px;margin:9px 0;font:inherit}.auth-modal button{width:100%;margin-top:9px}.auth-close{float:left;border:0;background:none;color:var(--muted);font-size:22px;cursor:pointer}.auth-switch{border:0!important;background:none!important;color:var(--teal);font-size:12px;cursor:pointer}.privacy-box{background:var(--soft);border-radius:8px;padding:9px;color:var(--teal);font-size:11px;margin-top:12px}';
document.head.appendChild(authStyle);
const authButton = document.createElement('button'); authButton.className = 'auth-link'; authButton.id = 'authButton'; $('.actions').prepend(authButton);
let authMode = 'login';
function refreshAuth() {
  const a = JSON.parse(localStorage.cvAccount || 'null');
  authButton.textContent = a ? (lang === 'ar' ? 'خروج ' + a.name : 'Logout ' + a.name) : (lang === 'ar' ? 'دخول / تسجيل' : 'Login / Register');
}
async function hashValue(v) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function authModal() {
  $('.auth-backdrop')?.remove(); const box = document.createElement('div'), ar = lang === 'ar'; box.className = 'auth-backdrop';
  box.innerHTML = `<form class="auth-modal" id="authForm"><button type="button" class="auth-close">×</button><h2>${authMode === 'login' ? (ar ? 'مرحبًا بعودتك' : 'Welcome back') : (ar ? 'أنشئ حسابك' : 'Create your account')}</h2>
    <p>${ar ? 'حساب محلي على جهازك لحماية سجل التحليلات. لا يتم رفع بيانات الحساب إلى خادم خارجي.' : 'A local account on this device keeps your analysis history private.'}</p>
    ${authMode === 'register' ? `<input id="authName" required placeholder="${ar ? 'الاسم' : 'Name'}">` : ''}<input id="authEmail" type="email" required placeholder="Email"><input id="authPassword" type="password" minlength="6" required placeholder="${ar ? 'كلمة المرور' : 'Password'}">
    <button class="btn primary" type="submit">${authMode === 'login' ? (ar ? 'دخول' : 'Login') : (ar ? 'تسجيل الحساب' : 'Register')}</button>
    <button class="auth-switch" type="button">${authMode === 'login' ? (ar ? 'ليس لديك حساب؟ سجّل الآن' : 'Need an account? Register') : (ar ? 'لديك حساب؟ ادخل الآن' : 'Already registered? Login')}</button>
    <div class="privacy-box">🔒 ${ar ? 'حساب محلي للاستخدام التجريبي. استخدم مصادقة خادمية عند النشر العام.' : 'Local demo account. Use server authentication for public deployment.'}</div></form>`;
  document.body.appendChild(box);
  box.querySelector('.auth-close').onclick = () => box.remove();
  box.querySelector('.auth-switch').onclick = () => { authMode = authMode === 'login' ? 'register' : 'login'; authModal(); };
  box.querySelector('#authForm').onsubmit = async e => {
    e.preventDefault(); const email = $('#authEmail').value.trim().toLowerCase(), password = await hashValue($('#authPassword').value), stored = JSON.parse(localStorage.cvAccount || 'null');
    if (authMode === 'register') { localStorage.cvAccount = JSON.stringify({ name: $('#authName').value.trim(), email, password }); box.remove(); refreshAuth(); return; }
    if (!stored || stored.email !== email || stored.password !== password) { alert(ar ? 'البريد أو كلمة المرور غير صحيحة.' : 'Invalid email or password.'); return; }
    box.remove(); refreshAuth();
  };
}
authButton.onclick = () => { if (localStorage.cvAccount) { localStorage.removeItem('cvAccount'); refreshAuth(); } else authModal(); };

/* ------------------------------------------------------------------ start */
setLang(); syncTheme(); renderServices(); refreshAuth();
$('#courseTiles').innerHTML = tiles(COURSE_SITES); $('#jobTiles').innerHTML = tiles(JOB_SITES);
/* share: link + QR (the link is editable so you can paste your public address) */
function drawQr() {
  const v = $('#siteUrl').value.trim(), box = $('#qrBox');
  try { box.innerHTML = v ? window.makeQrSvg(v) : ''; } catch { box.innerHTML = '<small>' + L('الرابط طويل جدًا للباركود', 'Link too long for a QR code') + '</small>'; }
}
$('#siteUrl').value = location.protocol.startsWith('http') ? location.origin + '/' : ''; $('#siteUrl').placeholder = 'https://your-site.example'; $('#siteUrl').oninput = drawQr; drawQr();
$('#copyUrl').onclick = async () => {
  const el = $('#siteUrl'), btn = $('#copyUrl'), done = () => { btn.textContent = L('تم النسخ ✓', 'Copied ✓'); setTimeout(() => { btn.textContent = L('نسخ الرابط', 'Copy link'); }, 1800); };
  try { await navigator.clipboard.writeText(el.value); done(); } catch { el.select(); document.execCommand && document.execCommand('copy'); done(); }
};
fetch('/api/catalog').then(r => r.ok ? r.json() : null).then(c => {
  if (!c) return; catalog = c;
  $('#roleList').innerHTML = c.roles.map(r => `<option value="${esc(r.ar)}">${esc(r.en)} — ${esc(r.sector)}</option><option value="${esc(r.en)}">${esc(r.ar)}</option>`).join('');
  if (SERVICES[svcCurrent].key === 'certs') showService(svcCurrent, false); renderCertSection();
}).catch(() => { });
renderCertSection();

/* tell the visitor clearly if the page is open without the analysis server (e.g. a static preview) */
fetch('/health').then(r => r.ok ? r.json() : Promise.reject()).then(h => {
  if (h.ocr && h.ocr.available && !h.ocr.arabic) { const b = $('#serverBanner'); b.hidden = false; b.textContent = L('تنبيه: قراءة العربية من الصور غير مفعّلة على هذا الخادم (ملف اللغة العربية غير مثبّت). PDF وDOCX والصور الإنجليزية تعمل.', 'Note: Arabic OCR is not enabled on this server. PDF, DOCX and English images work.'); }
}).catch(() => { const b = $('#serverBanner'); b.hidden = false; b.textContent = L('هذه الصفحة مفتوحة بدون خادم التحليل، لذا لن يعمل التحليل والفرز. شغّل المشروع (RUN_CVSMART.bat) أو انشره على استضافة Python لتعمل كل الميزات.', 'This page is open without the analysis server, so analysis and screening will not work. Run the project or deploy it to a Python host.'); });
