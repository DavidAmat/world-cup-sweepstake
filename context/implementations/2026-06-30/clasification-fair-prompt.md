# New Scoring and Clasification: "Clasificación Justa" (Fair Classification)

Some users have started claiming that there are a lot of matches that there is a goal in the 90th minute (or onwards in the ADDED TIME, we do NOT consider goals in the extra time), which completely changes whatever prediction they made on the result, and this penalizes them heavily. They are claiming that it will be great to have in parallel in a new tab named "La Porra Justa" in the Navbar that will be a dropdown of several options that redirect to different NEW pages:
- "Predicciones Partidos Justos": here is read only, we will have the same as the page that is Predicciones Partidos, but here the results will exclude the 90' goals and we will inform this like:
    - currently we show the actual result: i.e Costa de Marfil - Ecuador (2-1)
    - however we have created a JSON in which we detail all the matches that had goals in the added time so that we will SUBTRACT them. For example if Costa de Marfil scored the 2nd goal in the added time, here the "Resultado Justo" will be "1-1" because we will subtract that goal. In the json this will read:
```json
{
"external_id": "wc2026_md1_e_civ_ecu",
"goles_en_90": [
    {
    "equipo": "Costa de Marfil",
    "goles": 1
    }
]
}
```
    - this means that the points associated to this match, which in reality ended up as 2-1, now we will re-calculate them as if the match ended up as 1-1.
    - So the users win "Predicciones Partidos Justos" will see for each match the real score, the "Resultado Justo" below it (put it bigger than the real score to highlight that is the one that we are using now to compute the points) and keep the same UI for the points as if the real result was the "Resultado Justo".
- "Clasificación Justa" this will simply show the same as we currently have in Clasificación but for the points gathered assuming the "Resultado Justo" as the real result for that match.

So as you see we have to:
- create new pages
- create new tables in supabase (DO NOT modify ANYTHING of the current backend and frontend UI logic of the REAL scoring based on the REAL results, all the changes you do will be INCREMENTAL and will be inside this section "La Porra Justa"). The new tables in supabase will simply treat the "Resultado Justo" as the real result so that we will use these results to compute the points using the same logics and same rules, so nothing changes here, we only modify the real results and create a new classification board and a new UI for seeing the points on each match assuming the Resultado Justo as the real one

## Edge Cases

For the matches in "fase_grupos" we simply subtract the goals in the added time and compute the new score, that's it.

For the matches in tipo_partido "eliminatoria" we can have the casuistic of:

### Case 1: Goals that break the tie

In case a match (Canada vs. Sudafrica) is tied (0-0 for example) and a goal (Canada scores) occurs at 90th minute (then 1-0 for Canada) and finishes like this, if we subtract that goal, the "Resultado Justo" will be 0-0. The problem with a tie in a "eliminatoria" match is that then it would have implied "prorroga". This means that all the users that have predicted "prorroga" for that match will then get points on this. However, since this is a counterfactual extra time (it did not happen) we cannot know what really happened in that extra time. 

As a rule of thumb, any counterfactual extra time we will assume that:
- the team that in reality end up winning that match (irregardless of how many goals in the 90th minute it scored, we only cared that Canada was classified instead of playing extra time if these added time goals did not happen) we will assume that in the Resultado Justo they also win the eliminatoria, meaning that they go through the next phase, so that all the users that predicted that Canada will go through, get their points, but instead of a 1-0 as a result, we assume:
    - the "resultado justo" will be 0-0 and this is the result that the users will get points based on
    - we will also reward those users that put "prorroga" (we will NOT add points for the ones that also put penalties, only add points if a user predicted at least that there will be prorroga). With this, we ensure that we reward those users that were guessing right that there will be extra time, but due to a final goal in the added time, they lose all the points of that prediction.

### Case 2: Goals that force a prorroga

If a match (i.e Paises Bajos vs. Marruecos) is 1-0 and in the 90th minute the other team ties it (Marruecos scores, then 1-1) on the added time, the Resultado Justo will be 1-0 and the team that goes through will be Paises Bajos and we will NOT reward the users that put extra time and/or penalties at all (even though in reality that match went on penalties) because if it had ended in 1-0 the match will have ended on the 90 minutes without any extra time, so Paises Bajos will go through. 


## Classification Fair JSON
File: `context/implementations/2026-06-30/fair_clasification.json`
This file contains only the subset of FIFA World Cup 2026 matches in which at least one goal was scored during regulation stoppage time (90' or later, e.g. 90+1, 90+5, etc.). Matches without any goals from the 90th minute onwards are intentionally omitted to reduce storage and simplify lookups for late-goal related features.

Each object references a match through its external_id, which corresponds to the unique match identifier in fixtures.json. The goles_en_90 array contains one entry per team that scored during regulation stoppage time. Each entry includes the team name (equipo) and the total number of goals (goles) that team scored from the 90th minute onwards (including added time, but excluding goals scored in extra time or penalty shootouts). To retrieve the complete match information (teams, date, stage, etc.), join this file with fixtures.json using the external_id field.

## When adding the result

As an admin, I can manually introduce the results in `https://world-cup-sweepstake-mu.vercel.app/admin/results/` for a given match. When I press on "Introducir" button I get redirected to `https://world-cup-sweepstake-mu.vercel.app/admin/results/<id>` and there there should be a new div in which we have both teams and a box to input a number on both teams that is the number of goals scored in the added time.

This way for a match like Costa de Marfil vs. Ecuador, apart from the real result, I will put:

Resultado Real:
Costa de Marfil de Marfil 2 - Canada 1

Goles al 90:
Costa de Marfil de Marfil 1 - Canada 0

(by default if we leave those numbers as blank, we will assume that there were 0 goals in the added time so it will have no effect)

```json
{
"external_id": "wc2026_md1_e_civ_ecu",
"goles_en_90": [
    {
    "equipo": "Costa de Marfil",
    "goles": 1
    }
]
}
```

I recommend you create several NEW tables:
- one to store this info about which external_id match, which teams score which amount of goals in added time
- then you create the new table of the Resultados Justos (and in case of eliminatoria matches you need to apply the rules explained in the cases to dictate if the Resultado Justo implies an extra time or not and which is the team that goes through)
- then you create the new table of the Puntuación Justa (assuming that the Resultado Justo is the real result, compute the points)
- then you create the table for the classificacion justa (assuming the puntuacion justa as the real scoring)

# Clasificados de Grupo (Predicciones Iniciales)

DO NOT change this, simply use from the REAL results, which are the points to each user by guessing right the teams that will classify in the next round. The same will happen with the Pichichi, Campeon, Subcampeon, etc... All the predicciones iniciales should be granted the same points as the real results is doing. This thing of the "Resultado Justo" only applies for the scores of individual matches, we will NOT recomputed again the clasificacion of each grupo using the new results, etc... DO NOT DO THIS. This way it will be much simpler for you. 

# Instructions

Write your implementation plan in `context/implementations/2026-06-30/clasification-fair-plan.md`, write a final section of open questions only for things that are not clear or critical

Follow the hard-rule of NOT affecting the current logic, we have lots of data already, we are in the middle of the competition, so I don't want to erase data at all, neither affect the current scores of the real results, this is just an added functionality that will imply CREATING NEW TABLES, not editing any existing table. 