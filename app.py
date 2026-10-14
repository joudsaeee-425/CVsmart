# -*- coding: utf-8 -*-
"""CVSmart backend (Flask). Files are processed in memory only and never stored."""
import csv
import io
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

import analysis

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent if (HERE.parent / "index.html").exists() else HERE
ALLOWED = {"pdf", "docx", "doc", "txt", "jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff"}
MAX_FILE = 10 * 1024 * 1024
MAX_HR_FILES = 10
FRONT_FILES = {"index.html", "styles.css", "app.js", "qr.js"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 120 * 1024 * 1024

# ---------------------------------------------------------------- OCR setup
OCR_LANG = os.getenv("OCR_LANG", "ara+eng")
POPPLER = os.getenv("POPPLER_PATH") or None
try:
    import pytesseract
    cmd = os.getenv("TESSERACT_CMD") or shutil.which("tesseract")
    for cand in (r"C:\Program Files\Tesseract-OCR\tesseract.exe", r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"):
        if not cmd and Path(cand).exists():
            cmd = cand
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd
    local_tessdata = ROOT / "tessdata"
    if local_tessdata.exists() and not os.getenv("TESSDATA_PREFIX"):
        os.environ["TESSDATA_PREFIX"] = str(local_tessdata)
except Exception:  # pragma: no cover
    pytesseract = None


TESSDATA_URLS = {
    "ara": "https://github.com/tesseract-ocr/tessdata_fast/raw/main/ara.traineddata",
    "eng": "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata",
}
OCR_FETCH = {"state": "idle"}


def ensure_tessdata():
    """If Arabic OCR data is missing, download it once into ./tessdata (needs internet on the host)."""
    if not pytesseract:
        return
    try:
        if "ara" in set(pytesseract.get_languages(config="")):
            return
    except Exception:
        return
    target = ROOT / "tessdata"

    def work():
        import urllib.request
        OCR_FETCH["state"] = "downloading"
        try:
            target.mkdir(exist_ok=True)
            for lang, url in TESSDATA_URLS.items():
                dest = target / (lang + ".traineddata")
                if not dest.exists() or dest.stat().st_size < 100_000:
                    with urllib.request.urlopen(url, timeout=90) as r:
                        blob = r.read()
                    if len(blob) < 100_000:
                        raise ValueError("bad download")
                    dest.write_bytes(blob)
            os.environ["TESSDATA_PREFIX"] = str(target)
            OCR_FETCH["state"] = "ready"
        except Exception as e:  # keep running; Arabic OCR simply stays unavailable
            OCR_FETCH["state"] = "failed"

    import threading
    if (target / "ara.traineddata").exists() and (target / "eng.traineddata").exists():
        os.environ["TESSDATA_PREFIX"] = str(target)
        OCR_FETCH["state"] = "ready"
    else:
        threading.Thread(target=work, daemon=True).start()


ensure_tessdata()


def ocr_status():
    info = {"available": False, "arabic": False, "english": False, "version": "", "arabic_data": OCR_FETCH["state"]}
    if not pytesseract:
        return info
    try:
        info["version"] = str(pytesseract.get_tesseract_version())
        langs = set(pytesseract.get_languages(config=""))
        info.update(available=True, arabic="ara" in langs, english="eng" in langs)
    except Exception:
        pass
    return info


def ocr_image(img):
    if not pytesseract:
        raise ValueError("قراءة الصور تحتاج تثبيت Tesseract OCR. راجع ملف OCR_SETUP.md.")
    st = ocr_status()
    if st["available"] and not st["arabic"]:
        raise ValueError("قراءة العربية من الصور غير مفعّلة على هذا الخادم لأن ملف اللغة العربية (ara) غير مثبّت. راجع OCR_SETUP.md أو انشر المشروع بـ Docker.")
    try:
        return pytesseract.image_to_string(img, lang=OCR_LANG)
    except Exception:
        raise ValueError("تعذّرت قراءة الصورة. تأكد من تثبيت Tesseract مع اللغة العربية.")


# ---------------------------------------------------------------- text extraction
def extract_text(filename, data):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED:
        raise ValueError("صيغة الملف غير مدعومة. استخدم PDF أو DOCX أو TXT أو صورة.")
    if len(data) > MAX_FILE:
        raise ValueError("حجم الملف يتجاوز 10MB.")
    if ext == "txt":
        for enc in ("utf-8-sig", "cp1256", "latin-1"):
            try:
                return data.decode(enc)
            except UnicodeDecodeError:
                continue
    if ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(data))
            parts = [p.text for p in doc.paragraphs]
            for t in doc.tables:
                for row in t.rows:
                    parts.extend(c.text for c in row.cells)
            return "\n".join(parts)
        except Exception:
            raise ValueError("تعذّرت قراءة ملف DOCX. تأكد أنه غير تالف.")
    if ext == "doc":
        soffice = shutil.which("soffice") or shutil.which("libreoffice")
        antiword = shutil.which("antiword")
        if not soffice and antiword:
            with tempfile.TemporaryDirectory(prefix="cvsmart-doc-") as tmp:
                src = Path(tmp) / "resume.doc"
                src.write_bytes(data)
                out = subprocess.run([antiword, "-m", "UTF-8.txt", str(src)], capture_output=True, timeout=60)
                if out.stdout.strip():
                    return out.stdout.decode("utf-8", errors="replace")
            raise ValueError("تعذّر تحويل ملف DOC. حوّله إلى DOCX أو PDF.")
        if not soffice:
            raise ValueError("ملفات DOC القديمة تحتاج LibreOffice. حوّل الملف إلى DOCX أو PDF.")
        with tempfile.TemporaryDirectory(prefix="cvsmart-doc-") as tmp:
            src = Path(tmp) / "resume.doc"
            src.write_bytes(data)
            subprocess.run([soffice, "--headless", "--convert-to", "txt:Text", "--outdir", tmp, str(src)],
                           capture_output=True, timeout=90)
            out = src.with_suffix(".txt")
            if out.exists():
                return out.read_text(encoding="utf-8", errors="replace")
        raise ValueError("تعذّر تحويل ملف DOC. حوّله إلى DOCX أو PDF.")
    if ext == "pdf":
        text = ""
        try:
            from pypdf import PdfReader
            text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)
        except Exception:
            text = ""
        if len(text.strip()) >= 80:
            return text
        try:  # scanned PDF -> OCR
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(data, dpi=200, first_page=1, last_page=3, poppler_path=POPPLER)
        except Exception:
            raise ValueError("هذا PDF مصوّر ويحتاج Poppler وTesseract لقراءته. راجع ملف OCR_SETUP.md.")
        return "\n".join(ocr_image(p) for p in pages)
    from PIL import Image
    try:
        return ocr_image(Image.open(io.BytesIO(data)))
    except ValueError:
        raise
    except Exception:
        raise ValueError("تعذّرت قراءة الصورة.")


def fail(message, code=400):
    return jsonify({"ok": False, "error": message}), code


# ---------------------------------------------------------------- routes
@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:name>")
def front(name):
    if name in FRONT_FILES:
        return send_from_directory(ROOT, name)
    return fail("غير موجود", 404)


@app.post("/api/analyze")
def api_analyze():
    f = request.files.get("cv") or request.files.get("file")
    if not f or not f.filename:
        return fail("اختر ملف السيرة أولًا.")
    try:
        return jsonify(analysis.analyze(extract_text(f.filename, f.read())))
    except ValueError as e:
        return fail(str(e), 422)
    except Exception:
        return fail("حدث خطأ أثناء التحليل. جرّب ملفًا آخر.", 500)


@app.post("/api/hr/screen")
def api_hr_screen():
    files = [f for f in request.files.getlist("cvs") if f and f.filename]
    title = (request.form.get("title") or "").strip()
    if not title:
        return fail("اكتب المسمى الوظيفي المطلوب.")
    if not files:
        return fail("ارفع سيرة ذاتية واحدة على الأقل.")
    if len(files) > MAX_HR_FILES:
        return fail(f"الحد الأقصى {MAX_HR_FILES} سير ذاتية في كل مرة.")
    try:
        years = max(0, min(40, int(float(request.form.get("years") or 0))))
    except ValueError:
        years = 0
    ok, errors = [], []
    for f in files:
        try:
            ok.append((f.filename, extract_text(f.filename, f.read())))
        except ValueError as e:
            errors.append({"file": f.filename, "error": str(e)})
    if not ok:
        return fail("تعذّرت قراءة جميع الملفات.", 422) if not errors else (jsonify({"ok": False, "error": errors[0]["error"], "errors": errors}), 422)
    out = analysis.screen(ok, title, years)
    out.update(ok=True, title=title, required_years=years, total=len(files), errors=errors)
    return jsonify(out)


@app.get("/api/catalog")
def api_catalog():
    return jsonify(analysis.catalog())


@app.post("/api/powerbi.csv")
def api_powerbi():
    d = request.get_json(silent=True) or {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["metric", "value"])
    w.writerow(["cv_score", d.get("score", "")])
    w.writerow(["suggested_title", d.get("role_ar", "")])
    w.writerow(["years_experience", d.get("years", "")])
    for j in d.get("jobs", []):
        w.writerow(["job_match:" + str(j.get("ar", "")), j.get("match", "")])
    for m in d.get("missing", []):
        w.writerow(["missing_skill", m])
    return Response("\ufeff" + buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=CVSmart_PowerBI.csv"})


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "CVSmart", "ocr": ocr_status(), "roles": len(analysis.ROLE_DB)})


@app.errorhandler(413)
def too_large(_):
    return fail("حجم الملفات كبير جدًا.", 413)


if __name__ == "__main__":
    hosted = bool(os.getenv("PORT") or os.getenv("REPL_ID") or os.getenv("REPLIT_DEPLOYMENT"))
    app.run(host=os.getenv("HOST", "0.0.0.0" if hosted else "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=False)
