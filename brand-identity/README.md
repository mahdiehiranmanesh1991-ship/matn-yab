# آوای عدالت - فاز ۱: اکتشاف هویت بصری

سه مسیر خلاقانه کامل برای برند آموزش و رسانه حقوقی **آوای عدالت**.
هیچ مسیری هنوز به عنوان هویت نهایی قفل نشده است.

## مشاهده

فایل را در مرورگر باز کنید:

```text
brand-identity/index.html
```

یا از ریشه ریپو:

```bash
python3 -m http.server 8080
# سپس: http://localhost:8080/brand-identity/
```

## ساختار

| مسیر | پوشه | ایده |
|------|------|------|
| A اقتدار سرمقاله‌ای تجربی | `A-editorial/` | مجله حقوقی معتبر |
| B آرشیو حقوقی معاصر | `B-archive/` | پژوهشخانه / آرشیو زنده |
| C هوش هندسی | `C-geometric/` | وضوح ساختاری مدولار |

در هر پوشه:

- `wordmark.svg` / `wordmark-inverse.svg` - وردمارک فارسی outlined (قابل ویرایش)
- `symbol.svg` - نشان انتزاعی اصلی
- `logo-lockup.svg` - لاک‌آپ
- `moodboard.svg` - مودبورد
- `reel-cover.svg` - کاور ریل 9:16
- `animation-concept.svg` - پیش‌نمایش حرکت (SMIL)
- `lettering-concept.svg` - یادداشت حروف‌نگاری
- `tokens.json` - پالت و تایپ

بازتولید وردمارک‌ها:

```bash
python3 brand-identity/scripts/generate_wordmarks.py
```

## محدودیت‌های رعایت‌شده

بدون ترازو، پتک، ستون دادگاه؛ بدون طلا/مشکی لوکس اجباری؛ بدون نئون/گرادیان تزئینی؛ بدون آیکون استوک.
