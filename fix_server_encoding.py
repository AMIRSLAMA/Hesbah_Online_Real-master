from pathlib import Path
import re

project = Path(__file__).resolve().parent
source = project / "online" / "server.js"
backup = project / "online" / "server.js.before-targeted-fix.bak"

# احتياطي للنسخة الحالية
if not backup.exists():
    backup.write_bytes(source.read_bytes())

special = {
    chr(0x20AC): 0x80, chr(0x201A): 0x82, chr(0x0192): 0x83,
    chr(0x201E): 0x84, chr(0x2026): 0x85, chr(0x2020): 0x86,
    chr(0x2021): 0x87, chr(0x02C6): 0x88, chr(0x2030): 0x89,
    chr(0x0160): 0x8A, chr(0x2039): 0x8B, chr(0x0152): 0x8C,
    chr(0x017D): 0x8E, chr(0x2018): 0x91, chr(0x2019): 0x92,
    chr(0x201C): 0x93, chr(0x201D): 0x94, chr(0x2022): 0x95,
    chr(0x2013): 0x96, chr(0x2014): 0x97, chr(0x02DC): 0x98,
    chr(0x2122): 0x99, chr(0x0161): 0x9A, chr(0x203A): 0x9B,
    chr(0x0153): 0x9C, chr(0x017E): 0x9E, chr(0x0178): 0x9F
}

def reverse_mojibake(text):
    data = bytearray()

    for ch in text:
        code = ord(ch)

        if 128 <= code <= 159:
            data.append(code)

        elif ch in special:
            data.append(special[ch])

        elif code < 128:
            data.append(code)

        elif code <= 255:
            try:
                data.extend(ch.encode("cp1252"))
            except UnicodeEncodeError:
                data.extend(ch.encode("utf-8"))

        else:
            data.extend(ch.encode("utf-8"))

    return bytes(data).decode("utf-8")

def has_arabic(text):
    return any("\u0600" <= ch <= "\u06FF" for ch in text)

text = source.read_text(encoding="utf-8-sig")

# نبحث داخل نصوص JavaScript فقط
pattern = re.compile(r"""'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*" """)

fixed_count = 0

def fix_string(match):
    global fixed_count

    value = match.group(0)
    body = value[1:-1]

    # نعالج فقط النصوص التي ما زالت تحتوي على mojibake
    if ("Ø" not in body and "Ù" not in body):
        return value

    # لو النص يحتوي عربي صحيح بالفعل، لا نلمسه
    if has_arabic(body):
        return value

    try:
        fixed = reverse_mojibake(body)

        if fixed != body:
            fixed_count += 1
            return value[0] + fixed + value[-1]

    except Exception:
        pass

    return value

text = pattern.sub(fix_string, text)

source.write_text(text, encoding="utf-8-sig")

print("تم الإصلاح بنجاح.")
print("عدد النصوص التي تم إصلاحها:", fixed_count)

check = source.read_text(encoding="utf-8-sig")

print("Ø المتبقية:", check.count("Ø"))
print("Ù المتبقية:", check.count("Ù"))
print("مدير:", "مدير" in check)
print("دفع كاش عند الاستلام:", "دفع كاش عند الاستلام" in check)