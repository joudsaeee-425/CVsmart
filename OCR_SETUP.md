# تفعيل OCR في CVSmart

## 1. تثبيت Tesseract على Windows

ثبّت Tesseract OCR من المثبّت الرسمي، وتأكد من تفعيل Arabic language data أثناء التثبيت. المسار الشائع:

`C:\Program Files\Tesseract-OCR\tesseract.exe`

يمكن التحقق من التثبيت:

```powershell
& "C:\Program Files\Tesseract-OCR\tesseract.exe" --list-langs
```

يجب أن تظهر اللغتان `ara` و`eng`.

## 2. إعداد المسار

إذا لم يكن Tesseract في PATH، عرّف المتغير قبل تشغيل المشروع:

```powershell
$env:TESSERACT_CMD="C:\Program Files\Tesseract-OCR\tesseract.exe"
$env:OCR_LANG="ara+eng"
```

## 3. PDF المصور

صور JPG وPNG لا تحتاج Poppler. أما PDF المصور فيحتاج Poppler لتحويل الصفحات إلى صور. بعد تثبيته:

```powershell
$env:POPPLER_PATH="C:\Program Files\poppler\Library\bin"
```

## 4. التشغيل والتحقق

شغّل `RUN_CVSMART.bat` ثم افتح:

`http://127.0.0.1:5000/health`

يجب أن تعرض الاستجابة `ocr.available: true` و`ocr.arabic: true`. بعدها ارفع صورة أو PDF مصور من الواجهة، وسيقرأ CVSmart النص العربي والإنجليزي قبل التحليل.