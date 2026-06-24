# Trophy Room records correction - the championship week (post-apply league note)

*Draft for the commissioner to post AFTER migration 030 is applied. Names below use owner nicknames
(0001 Stu, 0002 KP, 0003 Pat, 0004 Eddie, 0005 Steve, 0006 Miller, 0007 Robb, 0008 Ben, 0009 Michele,
0010 Brandon) - swap to era-correct team names if the plaques display team names.*

---

## Records correction in the Trophy Room

Hey all,

A heads-up on a records fix that just went live, and the plaques it moved. I'd rather over-explain this than
have anyone notice a number changed and wonder why.

**The root cause - one bug, one story.** Our regular-season records were quietly counting the **championship
game**. The title game is a playoff game; it shouldn't sit in a team's regular-season win-loss, points-for, or
points-allowed. Points-allowed had already been fixed; this correction finishes the job so **wins/losses and
points-for** exclude the final too - for every season, exactly the way the rest of the record already reads.

Concretely: each season's **champion** had been carrying one extra win (the title game), the **runner-up** one
extra loss, and both finalists some extra points-for. Removing the final makes the regular-season record honest.
Nothing was hand-edited - every plaque is a *derived read* of the true record, so each one just follows the
corrected number. (2010-2020 and 2021+ are now both correct; the earlier fix had only reached 2021+.)

**Three derived trophies moved as a result:**

- **The Banner** (best regular-season record): a champion's removed title win no longer pads their record, so
  in two seasons the Banner is now **shared** with the team that actually had the best regular season.
- **The Engine** (most points in a season): with the title game's points out of the regular-season total, the
  season points lead moves off a finalist in six seasons.
- **The Climb** (biggest year-over-year improvement): because it's computed from those same corrected records,
  two seasons' biggest-improver changes hands.

**The full list** (for anyone who wants specifics):

| Trophy | Season | Now holds |
|---|---|---|
| The Banner | 2021 | Eddie *(already live)* |
| The Banner | 2024 | Michele *(already live)* |
| The Sieve | 2025 | Michele *(already live)* |
| The Banner | 2016 | Miller + Brandon *(now shared)* |
| The Banner | 2019 | KP + Steve *(now shared)* |
| The Engine | 2010 | KP |
| The Engine | 2015 | Michele |
| The Engine | 2016 | KP |
| The Engine | 2019 | Michele |
| The Engine | 2020 | Stu |
| The Engine | 2023 | Miller |
| The Climb | 2012 | Ben |
| The Climb | 2015 | Steve |

No standings, championships, or head-to-head results changed - only the regular-season tallies the title game
had been padding. Records are facts in here, and when one reads wrong we fix it in the open.

Questions, come find me.

- [Commissioner]
