# -*- coding: utf-8 -*-
"""CVSmart analysis engine (pure Python, no external services)."""
import datetime
import re
import unicodedata
from urllib.parse import quote

from knowledge import ALIASES, CERTS, LEARN_LINKS, ROLE_CERTS, ROLES, S, SECTOR_CERTS

NOW_YEAR = datetime.date.today().year
_DIAC = re.compile(r"[\u064B-\u065F\u0670\u0640]")
_ASCII_KW = re.compile(r"^[a-z0-9 +#./&'\-]+$")


def norm(text):
    t = unicodedata.normalize("NFKC", text or "")
    t = _DIAC.sub("", t)
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي")):
        t = t.replace(a, b)
    return t.lower()



_FIX = {"ادارة": "إدارة", "الادارة": "الإدارة", "الادارية": "الإدارية", "الاحصاء": "الإحصاء", "اكسل": "إكسل", "الامن": "الأمن", "امن": "أمن",
        "الاشراف": "الإشراف", "الاشعة": "الأشعة", "الانتاج": "الإنتاج", "انتاج": "إنتاج", "الاجراءات": "الإجراءات", "الاجازات": "الإجازات",
        "الاسطول": "الأسطول", "الاعلام": "الإعلام", "الاقرارات": "الإقرارات", "الارشاد": "الإرشاد", "الارشفة": "الأرشفة", "الاثر": "الأثر",
        "الاسر": "الأسر", "التاهيل": "التأهيل", "التامين": "التأمين", "التاشيرات": "التأشيرات", "مكافاة": "مكافأة", "المستاجرين": "المستأجرين",
        "التاجير": "التأجير", "الانظمة": "الأنظمة", "انظمة": "أنظمة", "الاحمال": "الأحمال", "الانابيب": "الأنابيب", "الاعطال": "الأعطال",
        "اصلاح": "إصلاح", "اوامر": "أوامر", "اجهزة": "أجهزة", "الاقسام": "الأقسام", "الادوية": "الأدوية", "اسنان": "أسنان", "اطفال": "أطفال",
        "الاحياء": "الأحياء", "الاشعاعية": "الإشعاعية", "الانشطة": "الأنشطة", "اوراق": "أوراق", "الاراء": "الآراء", "الاسعاف": "الإسعاف",
        "الاولي": "الأولي", "الاخلاء": "الإخلاء", "الايرادات": "الإيرادات", "ادخال": "إدخال", "انذار": "إنذار", "الامداد": "الإمداد",
        "الاشغال": "الإشغال", "ايجار": "إيجار", "الافات": "الآفات", "اتمتة": "أتمتة", "الاقتصاد": "الاقتصاد", "الاستلام": "الاستلام",
        "الاجتماعات": "الاجتماعات", "الاجهزة": "الأجهزة", "اشراف": "إشراف", "الاوامر": "الأوامر", "الانذار": "الإنذار"}


def pretty(label):
    return " ".join(_FIX.get(w, w) for w in label.split(" "))


def _syn_regex(syn):
    s = norm(syn).strip()
    if _ASCII_KW.match(s):
        return r"(?<![a-z0-9])" + re.escape(s) + r"(?![a-z0-9])"
    return re.escape(s)


def _compile_groups(kw_string):
    groups = []
    for grp in kw_string.split(","):
        syns = [x.strip() for x in grp.split("|") if x.strip()]
        if not syns:
            continue
        search = next((x for x in syns if _ASCII_KW.match(norm(x))), syns[0])
        groups.append({"label": pretty(syns[0]), "search": pretty(search),
                       "re": re.compile("|".join(_syn_regex(x) for x in syns))})
    return groups


def _title_regexes(ar, en):
    out = []
    for part in re.split(r"\s*/\s*", ar):
        part = norm(part).strip()
        if len(part) >= 3:
            out.append(re.escape(part))
    e = norm(en).strip()
    out.append(r"(?<![a-z0-9])" + re.escape(e) + r"(?![a-z0-9])")
    return re.compile("|".join(out))


ROLE_DB = []
for _i, (_sec, _ar, _en, _kw) in enumerate(ROLES):
    ROLE_DB.append({"id": _i, "sector": _sec, "sector_ar": S[_sec], "ar": _ar, "en": _en,
                    "groups": _compile_groups(_kw), "title_re": _title_regexes(_ar, _en),
                    "ar_n": norm(_ar), "en_n": norm(_en)})


def role_score(text_n, role):
    hits = [g for g in role["groups"] if g["re"].search(text_n)]
    title_hit = bool(role["title_re"].search(text_n))
    raw = len(hits) + (3 if title_hit else 0)
    denom = min(len(role["groups"]), 7) + 2
    return {"raw": raw, "pct": min(97, round(100 * raw / denom)), "hits": hits, "title_hit": title_hit}


# ------------------------------------------------------------------ language fixes
_COMMON_AR = ("من", "في", "على", "الى", "عن", "مع", "هذا", "التي", "الذي", "و")


def fix_arabic(text):
    """PDF extractors often return Arabic reversed; keep whichever direction reads like Arabic."""
    t = unicodedata.normalize("NFKC", (text or "").replace("\ufeff", ""))
    if len(re.findall(r"[\u0600-\u06FF]", t)) < 30:
        return t
    rev = "\n".join(line[::-1] for line in t.split("\n"))

    def score(x):
        words = re.findall(r"[\u0600-\u06FF]+", norm(x))
        return sum(1 for w in words if w in _COMMON_AR or w.startswith("ال"))
    return rev if score(rev) > score(t) * 1.3 else t


def detect_language(text):
    ar = len(re.findall(r"[\u0600-\u06FF]", text))
    en = len(re.findall(r"[A-Za-z]", text))
    return "ar" if ar > en * 0.6 else "en"


# ------------------------------------------------------------------ facts
_EDU_CTX = re.compile(r"bachelor|master|phd|diploma|university|college|gpa|school|بكالوريوس|ماجستير|دكتوراه|دبلوم|جامعه|كليه|معدل|ثانويه|ليسانس|education|التعليم")
_RANGE = re.compile(r"((?:19|20)\d{2})\s*(?:[-–—/]|to|الى|حتى)\s*((?:19|20)\d{2}|present|current|now|till date|الان|الحاضر|حاليا|حتى الان|اليوم)")
_YEARS = re.compile(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?|سنه|سنوات|سنين|عام|اعوام)")


def extract_years(text_n):
    explicit = 0
    for m in _YEARS.finditer(text_n):
        ctx = text_n[max(0, m.start() - 45): m.end() + 45]
        if re.search(r"experience|خبره|خبرات", ctx):
            explicit = max(explicit, int(m.group(1)))
    spans = []
    for m in _RANGE.finditer(text_n):
        ls = text_n.rfind("\n", 0, m.start()) + 1
        le = text_n.find("\n", m.end())
        ctx = text_n[ls: le if le != -1 else len(text_n)]
        if _EDU_CTX.search(ctx) and not re.search(r"experience|work|employ|خبره|خبرات|وظيف", ctx):
            continue
        a = int(m.group(1))
        b = m.group(2)
        b = int(b) if b.isdigit() else NOW_YEAR
        if 1980 <= a <= b <= NOW_YEAR:
            spans.append((a, b))
    spans.sort()
    total, cur = 0, None
    for a, b in spans:
        if cur and a <= cur[1]:
            cur = (cur[0], max(cur[1], b))
        else:
            if cur:
                total += cur[1] - cur[0]
            cur = (a, b)
    if cur:
        total += cur[1] - cur[0]
    return min(45, max(explicit, total)), bool(explicit or spans)


def extract_education(text_n):
    levels = [("دكتوراه", r"phd|doctorate|دكتوراه"), ("ماجستير", r"(?<!scrum )(?<!data )\bmaster(?:'s|s)?\b|\bmsc\b|\bmba\b|ماجستير"),
              ("بكالوريوس", r"bachelor|\bbsc\b|\bb\.?a\b|بكالوريوس|ليسانس"), ("دبلوم", r"diploma|دبلوم"),
              ("ثانوية", r"high school|secondary|ثانويه")]
    for name, pat in levels:
        if re.search(pat, text_n):
            return name
    return ""


def level_for(years):
    if years < 1:
        return "خريج / مبتدئ", "Entry level"
    if years < 3:
        return "مبتدئ", "Junior"
    if years < 6:
        return "متوسط الخبرة", "Mid-level"
    if years < 10:
        return "خبير / أول", "Senior"
    return "خبير قيادي", "Lead / Expert"


def extract_contact(text):
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    phone = ""
    for m in re.finditer(r"\+?\d[\d\s\-()]{8,16}\d", text):
        digits = re.sub(r"\D", "", m.group())
        if 9 <= len(digits) <= 13 and not re.search(r"(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}", m.group()):
            phone = m.group().strip()
            break
    return (email.group() if email else ""), phone


def guess_name(text, filename):
    stem = re.sub(r"\.[A-Za-z0-9]+$", "", filename)
    for line in text.split("\n"):
        if not line.strip():
            continue
        s = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", " ", line)
        s = re.sub(r"[+\d()\-_|•·:،,;]+", " ", s)
        s = " ".join(s.split())
        if 2 <= len(s.split()) <= 4 and 3 <= len(s) <= 40 and not re.search(
                r"resume|curriculum|vitae|cv|السيره|الذاتيه|summary|objective|experience|profile|بكالوريوس|المؤهل|الهدف", norm(s)):
            return s
        break
    return stem


_SECTIONS = {
    "summary": r"\bsummary\b|objective|about me|profile|نبذه|ملخص|الهدف الوظيفي|الهدف المهني",
    "education": r"education|academic|التعليم|المؤهلات|المؤهل العلمي|المؤهل الاكاديمي",
    "experience": r"experience|employment|work history|الخبرات|الخبره|الخبره العمليه|الخبرات العمليه|السجل الوظيفي",
    "skills": r"\bskills\b|competenc|المهارات|مهارات|الكفايات",
    "certs": r"certificat|courses|training|الشهادات|الدورات|دورات|التدريب",
    "projects": r"projects|المشاريع|مشاريع",
    "languages": r"languages|اللغات|لغات",
}


def detect_sections(text_n):
    return {k: bool(re.search(v, text_n)) for k, v in _SECTIONS.items()}


def score_cv(text, text_n, sections, skills_found, years):
    email, phone = extract_contact(text)
    words = len(text_n.split())
    numbers = len(re.findall(r"\d+\s*%|\d{2,}\s*(?:\+|k\b)|[$﷼]\s*\d|\b\d{3,}\b", text_n))
    checks = [
        ("contact", "بيانات تواصل واضحة (بريد إلكتروني ورقم جوال)", bool(email) and bool(phone), 10),
        ("summary", "ملخص مهني في أعلى السيرة", sections["summary"], 8),
        ("education", "قسم المؤهلات التعليمية", sections["education"], 10),
        ("experience", "قسم الخبرات العملية", sections["experience"] or years > 0, 15),
        ("skills", "قسم مهارات منظم", sections["skills"], 10),
        ("numbers", "إنجازات مدعومة بأرقام ونسب", numbers >= 3, 10),
        ("certs", "دورات أو شهادات مهنية", sections["certs"], 7),
        ("projects", "مشاريع أو إنجازات مميزة", sections["projects"], 5),
        ("languages", "اللغات التي تجيدها", sections["languages"], 5),
        ("length", "طول مناسب (بين صفحة وصفحتين تقريبًا)", 150 <= words <= 1100, 5),
    ]
    pts = sum(w for _, _, ok, w in checks if ok) + min(15, len(skills_found) * 2)
    return min(98, max(12, pts)), [{"id": i, "label": l, "ok": bool(ok)} for i, l, ok, _ in checks]


# ------------------------------------------------------------------ certificates
def certs_for(role, text_n, limit=5):
    keys = ROLE_CERTS.get(role["en"]) or SECTOR_CERTS.get(role["sector"], [])
    have, rec = [], []
    for k in keys:
        name, issuer, url, cost, kw = CERTS[k]
        item = {"key": k, "name": name, "issuer": issuer, "url": url, "cost": cost}
        (have if norm(kw) in text_n else rec).append(item)
    for it in rec:
        it["reason"] = "مرتبطة بمسار " + role["ar"] + " وتقوّي سيرتك أمام أصحاب العمل"
    return rec[:limit], have


def catalog():
    by_sector = {}
    for sec, keys in SECTOR_CERTS.items():
        by_sector[S[sec]] = [{"key": k, "name": CERTS[k][0], "issuer": CERTS[k][1], "url": CERTS[k][2], "cost": CERTS[k][3]} for k in keys]
    roles = [{"ar": r["ar"], "en": r["en"], "sector": r["sector_ar"]} for r in ROLE_DB]
    return {"roles": roles, "certs": by_sector}


# ------------------------------------------------------------------ main analysis
def analyze(text):
    text = fix_arabic(text)
    text_n = norm(text)
    if len(text_n.strip()) < 40:
        raise ValueError("لم أتمكن من قراءة نص كافٍ من الملف. جرّب ملفًا نصيًا أو صورة أوضح.")
    lang = detect_language(text)
    scored = sorted((dict(role_score(text_n, r), role=r) for r in ROLE_DB), key=lambda x: (-x["raw"], -x["pct"]))
    best = scored[0]
    years, years_found = extract_years(text_n)
    level_ar, level_en = level_for(years)
    sections = detect_sections(text_n)
    role = best["role"] if best["raw"] >= 2 else None
    confidence = "high" if best["raw"] >= 6 else "medium" if best["raw"] >= 3 else "low"
    skills = [g["label"] for g in best["hits"]] if role else []
    missing = [g for g in role["groups"] if g not in best["hits"]][:6] if role else []
    score, checklist = score_cv(text, text_n, sections, skills, years)
    if role:
        recs, have = certs_for(role, text_n)
        sector_ar = role["sector_ar"]
    else:
        recs, have, sector_ar = [], [], ""
    jobs = [{"ar": s["role"]["ar"], "en": s["role"]["en"], "sector": s["role"]["sector_ar"], "match": s["pct"]}
            for s in scored[:5] if s["raw"] >= 2] if role else []
    courses = [{"skill": g["label"], "links": [{"name": n, "url": u.format(q=quote(g["search"]))} for n, u in LEARN_LINKS]} for g in missing[:4]]
    tips = []
    for c in checklist:
        if not c["ok"]:
            tips.append({"contact": "أضف بريدك الإلكتروني ورقم جوالك في أعلى السيرة.",
                         "summary": "اكتب ملخصًا مهنيًا من 3 إلى 4 أسطر يوضح تخصصك وما تقدمه.",
                         "education": "أضف قسمًا واضحًا للمؤهلات (التخصص، الجهة، سنة التخرج).",
                         "experience": "أضف قسم الخبرات العملية مع المسمى والجهة والفترة والإنجازات.",
                         "skills": "أضف قسمًا للمهارات مرتبًا بحسب الأهمية للوظيفة المستهدفة.",
                         "numbers": "حوّل المهام إلى إنجازات بالأرقام (نسب، مبالغ، أعداد، مدة).",
                         "certs": "أضف الدورات والشهادات المهنية التي حصلت عليها.",
                         "projects": "أضف مشاريع أو مبادرات تُظهر مهاراتك عمليًا.",
                         "languages": "اذكر اللغات التي تجيدها ومستواك فيها.",
                         "length": "اجعل السيرة بين صفحة وصفحتين، واحذف المعلومات غير المرتبطة بالوظيفة."}[c["id"]])
    if missing:
        tips.append("إن كنت تتقن هذه المهارات فأضفها بصياغة واضحة: " + "، ".join(g["label"] for g in missing[:4]) + ".")
    if not role:
        tips.insert(0, "لم نتمكن من تحديد تخصصك بدقة. اذكر مسماك الوظيفي ومهاراتك وأدواتك بوضوح في السيرة.")
    tips = tips[:8]
    return {
        "ok": True, "language": lang, "score": score, "confidence": confidence,
        "role_ar": role["ar"] if role else "غير محدد — يلزم توضيح التخصص", "role_en": role["en"] if role else "Not determined",
        "sector": sector_ar, "years": years, "years_found": years_found, "level_ar": level_ar, "level_en": level_en,
        "education": extract_education(text_n), "skills": skills, "missing": [g["label"] for g in missing],
        "jobs": jobs, "certs": recs, "certs_have": have, "courses": courses, "tips": tips, "checklist": checklist,
        "improved": improved_text(role, skills, years, level_ar, extract_education(text_n)),
    }


def improved_text(role, skills, years, level_ar, education):
    title = role["ar"] if role else "المسمى الوظيفي المستهدف"
    sector = role["sector_ar"] if role else "مجال تخصصك"
    exp = "حديث التخرج" if years < 1 else f"بخبرة {years} {'سنة' if years < 11 else 'سنوات'}"
    top = "، ".join(skills[:4]) if skills else "مهاراتك الأساسية"
    lines = ["السيرة الذاتية المحسّنة — CVSmart", "",
             f"المسمى المستهدف: {title}", f"المستوى: {level_ar}" + (f" · المؤهل: {education}" if education else ""), "",
             "ملخص مهني مقترح:",
             f"{title} {exp} في مجال {sector}، يمتلك مهارات في {top}، ويسعى لتقديم قيمة مضافة وتحقيق نتائج قابلة للقياس.", "",
             "المهارات الأساسية: " + (" • ".join(skills) if skills else "(أضف مهاراتك هنا)"), "",
             "تذكير: الصق خبراتك وإنجازاتك الحقيقية فقط، وأضف لكل إنجاز رقمًا أو نتيجة قابلة للقياس."]
    return "\n".join(lines)


# ------------------------------------------------------------------ HR screening
_STOP = {"مدير", "اخصائي", "مهندس", "senior", "junior", "specialist", "manager", "officer"}


def resolve_title(query):
    q = norm(query).strip()
    if not q:
        return None
    best, best_s = None, 0.0
    qt = set(re.findall(r"[\w#+.]+", q))
    for r in ROLE_DB:
        s = 0.0
        for t in (r["ar_n"], r["en_n"]):
            if q == t:
                s = 1.0
            elif len(q) >= 3 and (q in t or t in q):
                s = max(s, 0.85)
            else:
                tt = set(re.findall(r"[\w#+.]+", t))
                if tt and qt:
                    s = max(s, len(qt & tt) / len(qt | tt))
        if s > best_s:
            best, best_s = r, s
    for alias, en in ALIASES.items():
        if re.search(r"(?<![\w])" + re.escape(norm(alias)) + r"(?![\w])", q) and best_s < 0.8:
            r = next((x for x in ROLE_DB if x["en"] == en), None)
            if r:
                best, best_s = r, 0.8
    return best if best_s >= 0.45 else None


def screen(candidates, title_query, required_years):
    role = resolve_title(title_query)
    q_n = norm(title_query).strip()
    q_tokens = [t for t in re.findall(r"[\w#+.]+", q_n) if len(t) >= 2 and t not in _STOP] or re.findall(r"[\w#+.]+", q_n)
    out = []
    for fname, text in candidates:
        text = fix_arabic(text)
        text_n = norm(text)
        years, years_found = extract_years(text_n)
        phrase = 1.0 if q_n and q_n in text_n else (sum(1 for t in q_tokens if t in text_n) / len(q_tokens) if q_tokens else 0)
        align, cov, matched, missing = 0.0, phrase, [], []
        if role:
            rs = role_score(text_n, role)
            align = rs["pct"] / 100
            cov = len(rs["hits"]) / max(1, min(len(role["groups"]), 8))
            matched = [g["label"] for g in rs["hits"]][:8]
            missing = [g["label"] for g in role["groups"] if g not in rs["hits"]][:4]
            phrase = max(phrase, 1.0 if rs["title_hit"] else 0)
        title_comp = max(phrase, align)
        exp_comp = 1.0 if required_years <= 0 else min(1.0, years / required_years)
        w = (0.40, 0.35, 0.25) if role else (0.55, 0.20, 0.25)
        score = round(100 * (w[0] * title_comp + w[1] * min(1.0, cov) + w[2] * exp_comp))
        verdict = ("مرشح قوي", "good") if score >= 75 else ("مناسب", "ok") if score >= 55 else ("مناسب جزئيًا", "mid") if score >= 35 else ("غير مناسب", "low")
        if required_years > 0:
            if not years_found:
                note = f"لم تُكتشف سنوات الخبرة (المطلوب {required_years})"
            elif years >= required_years:
                note = f"{years} سنوات — يحقق الخبرة المطلوبة ({required_years})"
            else:
                note = f"{years} سنوات — أقل من المطلوب ({required_years})"
        else:
            note = f"{years} سنوات خبرة" if years_found else "لم تُكتشف سنوات الخبرة"
        email, phone = extract_contact(text)
        best = max(((role_score(text_n, r), r) for r in ROLE_DB), key=lambda x: (x[0]["raw"], x[0]["pct"]))
        out.append({"file": fname, "name": guess_name(text, fname), "email": email, "phone": phone, "years": years,
                    "education": extract_education(text_n), "score": score, "verdict": verdict[0], "verdict_class": verdict[1],
                    "suggested_title": best[1]["ar"] if best[0]["raw"] >= 2 else "", "matched": matched, "missing": missing,
                    "experience_note": note, "meets_experience": required_years <= 0 or years >= required_years})
    out.sort(key=lambda x: (-x["score"], -x["years"]))
    for i, o in enumerate(out, 1):
        o["rank"] = i
    return {"matched_role": {"ar": role["ar"], "en": role["en"], "sector": role["sector_ar"]} if role else None,
            "results": out}
