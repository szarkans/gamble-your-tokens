"""Проверка денег на сервере: ход меняет день, рекорды считаются из истории. python3 app/test_serve.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serve import apply_round, new_day, records  # noqa: E402

day = new_day()
apply_round(day, {"game": "slots", "bet": 10_000, "back": 200_000, "label": "7 7 7"}, earned_total=1_000_000)
apply_round(day, {"game": "blackjack", "bet": 50_000, "back": 0}, earned_total=1_100_000)
apply_round(day, {"game": "roulette", "bet": 20_000, "back": 20_000}, earned_total=1_100_000)  # ничья
assert day["net"] == 190_000 - 50_000, day["net"]
assert day["rounds"] == 3 and day["won_rounds"] == 1 and day["wagered"] == 80_000
assert day["best"]["profit"] == 190_000 and day["worst"]["profit"] == -50_000
assert day["earned"] == 1_100_000

bust = new_day()
apply_round(bust, {"game": "slots", "bet": 500_000, "back": 0}, earned_total=500_000)
assert bust["broke"] == 1

h = {"days": {"2026-10-01": day, "2026-10-02": bust, "2026-10-03": new_day()}}  # день без ходов не считается
r = records(h)
assert r["days_played"] == 2 and r["rounds"] == 4 and r["broke"] == 1
assert r["best_win"]["profit"] == 190_000 and r["best_win"]["date"] == "2026-10-01"
assert r["worst_loss"]["profit"] == -500_000 and r["worst_day"]["date"] == "2026-10-02"
assert r["lifetime_lost"] == 500_000 and r["lifetime_won"] == 140_000

for bad in ({"bet": 0, "back": 0}, {"bet": 10, "back": -1}, {"back": 5}):
    try:
        apply_round(new_day(), bad, 0)
    except (ValueError, KeyError):
        pass
    else:
        raise AssertionError(f"принял плохой ход {bad}")
print("ok")
