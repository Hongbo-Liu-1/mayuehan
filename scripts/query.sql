SELECT t.*, s.cname AS sport_name, e.cname AS event_name, e.team_size
FROM team AS t
LEFT JOIN sport AS s
ON t.sport_id = s.id
LEFT JOIN sport_event AS e 
ON t.event_id = e.id
JOIN team_player AS tp
ON t.id = tp.team_id
WHERE t.sport_id = 1


SELECT p.*, tp.team_id
            FROM team_player as tp
            INNER JOIN team as t
            ON tp.team_id = t.id
            INNER JOIN player as p
            ON tp.player_id = p.id

select p.*
FROM player as p
LEFT JOIN team_player as tp ON p.