"""
產生 Wordlee 的字庫與離線字典資料。

用法:
    pip install opencc-python-reimplemented
    python scripts/build_words.py <ecdict.csv> <enable1.txt>

資料來源:
    - ECDICT (MIT License)   https://github.com/skywind3000/ECDICT
      提供中文翻譯、詞性、詞頻、考試標籤與詞形變化(複數、過去式…)
    - ENABLE word list (Public Domain)  https://github.com/dolph/dictionary
      作為「可以猜的合法單字」的主要來源

輸出 (shared/src/data/,N = 5、6、7 個字母):
    answers-N.json  可能成為答案的常見單字(已打亂順序,每日題目依序取)
    valid-N.json    其他可以猜、但不會當答案的單字
    dict-N.json     離線字典:音標、中文翻譯(繁體)、詞形變化
    s2t.json      精簡版簡→繁對照表(線上例句若只有簡體翻譯,App 端用它轉成繁體)
"""
import csv
import json
import os
import random
import sys
from pathlib import Path

from opencc import OpenCC

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shared" / "src" / "data"

# 考試／教材標籤:zk 中考, gk 高考, cet4/6 大學英檢, ky 考研, toefl, ielts, gre
COMMON_TAGS = {"zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts"}

# 不適合當答案的字(仍可以猜)
ANSWER_BLOCKLIST = {
    "bitch", "whore", "slut", "pussy", "dicks", "cunts", "penis", "nigga", "negro",
    "dildo", "boobs", "porno", "horny", "semen", "sperm", "rapes", "raped", "rapist",
    "nazis", "faggy", "gooks", "kikes", "wanks", "turds", "crapy", "sluts", "bitty",
    "fucks", "shits", "tits", "booby", "titty", "kinky", "pubic", "anal", "enema",
    "vomit", "faggot", "nigger", "bitches", "whores", "fucker", "fucking", "pissed",
    "orgasm", "erotic", "condom", "vagina", "breast", "rapist", "molest", "porn",
    "hooker", "pervert", "nipple", "testes", "scrotum", "semens", "sodomy", "incest",
    "suicide", "bastard", "slutty", "killer",
}

cc = OpenCC("s2twp")  # 簡體 → 台灣正體(含常用詞彙轉換)


def parse_exchange(s: str) -> dict:
    out = {}
    for part in s.split("/"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k] = v
    return out


def clean_translation(tr: str) -> list:
    """把 ECDICT 的翻譯拆成 [詞性, 中文] 列表,移除過長的網路釋義。"""
    lines = [l.strip() for l in tr.replace("\\n", "\n").split("\n") if l.strip()]
    main = [l for l in lines if not l.startswith("[网络]")]
    if not main:
        main = [l.replace("[网络]", "").strip() for l in lines][:1]
    out = []
    for line in main[:6]:
        line = cc.convert(line)
        pos, _, rest = line.partition(" ")
        rest = rest.strip().replace(", ", "，").replace(",", "，")
        if pos.endswith(".") and len(pos) <= 7 and rest:
            out.append([pos, rest])
        else:
            out.append(["", line.replace(", ", "，")])
    return out


LENGTHS = (5, 6, 7)
# 每種長度各自打亂答案順序;5 個字母沿用最早的種子,已經出過的每日題目才不會變
SEEDS = {5: 20261104, 6: 20261106, 7: 20261107}


def build_length(n: int, rows: dict, enable_all: set, ecdict_path: str, lemma_tr: dict):
    enable = {w for w in enable_all if len(w) == n}
    rows = {w: r for w, r in rows.items() if len(w) == n}

    def is_abbr(r):
        return r["translation"].lstrip().startswith("abbr.")

    def freq(r):
        return int(r["frq"] or 0)

    # 1) 合法猜測:ENABLE 全部 + ECDICT 中常見(有標籤或詞頻前 30000)且非縮寫的字
    valid = set(enable)
    for w, r in rows.items():
        tags = set(r["tag"].split())
        if r["translation"].strip() and not is_abbr(r) and (tags & COMMON_TAGS or 0 < freq(r) <= 30000):
            valid.add(w)

    # 2) 答案:常見、不是詞形變化(複數/過去式…)、有中文翻譯
    answers = []
    for w in sorted(valid):
        r = rows.get(w)
        if not r or not r["translation"].strip() or is_abbr(r) or w in ANSWER_BLOCKLIST:
            continue
        ex = parse_exchange(r["exchange"])
        if "0" in ex and ex["0"] != w:
            continue  # 是別的字的變化形
        if w not in enable:
            continue  # 答案只取兩個字庫都有的字,避免冷僻拼法
        tags = set(r["tag"].split())
        f = freq(r)
        if (tags & COMMON_TAGS and (f == 0 or f <= 20000)) or (0 < f <= 12000):
            answers.append(w)

    rng = random.Random(SEEDS[n])
    rng.shuffle(answers)
    answer_set = set(answers)

    # 3) 離線字典
    dictionary = {}
    for w in sorted(valid):
        r = rows.get(w)
        if not r or not r["translation"].strip():
            continue
        ex = parse_exchange(r["exchange"])
        entry = {"t": clean_translation(r["translation"])}
        ph = r["phonetic"].strip()
        if ph and "^" not in ph:  # ECDICT 少數音標編碼損壞,略過;線上字典會補上
            entry["ph"] = ph
        forms = {k: v for k, v in ex.items() if k in "pdi3rts" and v and v != w}
        if forms:
            entry["f"] = forms
        if "0" in ex and ex["0"] != w:
            entry["lemma"] = ex["0"]
            entry["lt"] = ex.get("1", "")
            if ex["0"] in lemma_tr:
                entry["lt_tr"] = lemma_tr[ex["0"]][:3]
        dictionary[w] = entry

    (OUT / f"answers-{n}.json").write_text(json.dumps(answers), encoding="utf-8")
    (OUT / f"valid-{n}.json").write_text(json.dumps(sorted(valid - answer_set)), encoding="utf-8")
    (OUT / f"dict-{n}.json").write_text(
        json.dumps(dictionary, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"[{n}] answers={len(answers)} valid_extra={len(valid - answer_set)} dict={len(dictionary)}")


def main(ecdict_path: str, enable_path: str) -> None:
    enable = {w.strip() for w in open(enable_path, encoding="utf-8") if len(w.strip()) in LENGTHS}

    rows, all_tr = {}, {}
    with open(ecdict_path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            w = r["word"]
            if w.isascii() and w.isalpha() and w.islower():
                if r["translation"].strip():
                    all_tr[w] = r["translation"]
                if len(w) in LENGTHS:
                    rows[w] = r

    # 變化形的原形(例如 geese → goose)可能是任何長度,先把需要的原形翻譯準備好
    lemmas = set()
    for w, r in rows.items():
        ex = parse_exchange(r["exchange"])
        if "0" in ex and ex["0"] != w:
            lemmas.add(ex["0"])
    lemma_tr = {w: clean_translation(all_tr[w]) for w in lemmas if w in all_tr}

    OUT.mkdir(parents=True, exist_ok=True)
    for n in LENGTHS:
        build_length(n, rows, enable, ecdict_path, lemma_tr)

    s2t = build_s2t()
    (OUT / "s2t.json").write_text(json.dumps(s2t, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"s2t chars={len(s2t['c']) // 2} phrases={len(s2t['p'])}")


def build_s2t() -> dict:
    """從 OpenCC 的字典產生精簡對照表:單字對照 + 「單字轉換會轉錯」的詞組。"""
    import opencc

    base = Path(os.path.dirname(opencc.__file__)) / "dictionary"

    def load(name):
        out = {}
        for line in (base / name).read_text(encoding="utf-8").splitlines():
            if "\t" in line:
                k, v = line.split("\t", 1)
                out[k] = v.split(" ")[0]
        return out

    chars = load("STCharacters.txt")
    tw_var = load("TWVariants.txt")
    chars = {k: tw_var.get(v, v) for k, v in chars.items() if tw_var.get(v, v) != k}

    def by_char(text):
        return "".join(chars.get(c, c) for c in text)

    phrases = {}
    for k, v in load("STPhrases.txt").items():
        v = "".join(tw_var.get(c, c) for c in v)
        if len(k) <= 4 and by_char(k) != v:
            phrases[k] = v
    return {"c": "".join(k + v for k, v in chars.items() if len(k) == 1 and len(v) == 1), "p": phrases}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
