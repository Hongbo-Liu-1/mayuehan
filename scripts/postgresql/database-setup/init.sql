BEGIN;

-- Drop table

-- DROP TABLE public."info";

CREATE TABLE public.info (
    id serial NOT NULL,
	name text NOT NULL,
	text_value text NULL,
	int_value integer NULL,
	update_time timestamptz NULL,
    CONSTRAINT info_pkey PRIMARY KEY (id)
);
INSERT INTO public.info (name, text_value, int_value, update_time) VALUES ('active_version', '1.0.0', NULL, current_timestamp);
INSERT INTO public.info (name, text_value, int_value, update_time) VALUES ('current_round', NULL, 0, current_timestamp);


-- DROP TABLE public.court;

CREATE TABLE public.court (
	id serial NOT NULL,
	ename text NULL,
    cname text NULL,
	busy boolean default false,
	sport_id integer NULL,
	CONSTRAINT court_pkey PRIMARY KEY (id)
);

-- Drop table

-- DROP TABLE public.sport;

CREATE TABLE public.sport (
	id serial NOT NULL,
	ename text NULL,
	cname text NULL,
    points_rule text NULL,
	CONSTRAINT sport_pkey PRIMARY KEY (id)
);

INSERT INTO public.sport (id, ename, cname) VALUES 
(1, 'Running','跑步'),
(2, 'Golf','高尔夫球'),
(3, 'Badminton','羽毛球'),
(4, 'Tennis','网球'),
(5, 'Table Tennis','乒乓球');

-- Drop table

-- DROP TABLE public.sport_event;

CREATE TABLE public.sport_event (
	id serial NOT NULL,
	ename text NULL,
	cname text NULL,
	sport_id integer NULL,
	team_size integer default 1,
    team_prefix text NULL,
	CONSTRAINT sport_event_pkey PRIMARY KEY (id)
);

INSERT INTO public.sport_event (id,ename,cname,sport_id,team_size,team_prefix) VALUES 
(11,'Morning Running','晨跑',1,1,'MR'),
(12,'Relay Race','接力团体赛',1,4,'M50'),
(13,'Men Over 50','男50+个人',1,4,'M50'),
(14,'Women Over 50','女50+个人',1,4,'W50'),
(15,'Men Under 49','男49-个人',1,4,'M49'),
(16,'Women Under 49','女49-个人',1,4,'W49'),
(21,'Men A Stroke Play','男甲总杆赛',2,1,'G'),
(22,'Men A Net Stroke Play','男甲净杆赛',2,1,'G'),
(23,'Men Group B Stroke Play','男乙总杆赛',2,1,'G'),
(24,'Men Group B Net Stroke Play','男乙净杆赛',2,1,'G'),
(25,'Women Stroke Play','女子总杆赛',2,1,'G'),
(26,'Women Net Stroke Play','女子净杆赛',2,1,'G'),
(27,'Doulbe Match','双人赛',2,1,'G'),
(31,'Men''s Double','男双',3,2,'MD'),
(32,'Women''s Double','女双',3,2,'WD'),
(33,'Mixed Double','混双',3,2,'XD'),
(34,'Men''s Single','男单',3,1,'MS'),
(35,'Women''s Single','女单',3,1,'WS'),
(41,'Men''s Double','男双',4,2,'MD'),
-- (42,'Women''s Double','女双',4,2,'WD'),
(43,'Mixed Double','混双',4,2,'XD'),
(44,'Men''s Single','男单',4,1,'MS'),
-- (45,'Women''s Single','女单',4,1,'WS'),
(51,'Men''s Double','男双',5,2,'MD'),
(52,'Women''s Double','女双',5,2,'WD'),
(53,'Mixed Double','混双',5,2,'XD'),
(54,'Men''s Single','男单',5,1,'MS'),
(55,'Women''s Single','女单',5,1,'WS');


-- Drop table

-- DROP TABLE public.th_association;

-- alumni association
CREATE TABLE public.th_association (
	id serial NOT NULL,
	ename text NULL,
    cname text NULL,
	points integer default 0,
	online_run_join boolean NULL,
	online_run_rank integer NULL,
	online_run_points integer default 0,
	CONSTRAINT th_association_pkey PRIMARY KEY (id)
);

INSERT INTO public.th_association (cname) VALUES
('北卡罗来纳'),
('费城'),
('匹兹堡'),
('奥斯汀'),
('达拉斯'),
('休斯顿'),
('俄亥俄州哥伦布'),
('辛辛那提'),
('俄勒冈'),
('佛罗里达'),
('大华府'),
('西雅图'),
('北加州'),
('硅谷'),
('南加州'),
('圣地亚哥'),
('堪萨斯'),
('康涅狄格'),
('波士顿'),
('圣路易斯'),
('密歇根'),
('明尼苏达'),
('纽约'),
('乔治亚'),
('纳什维尔'),
('威斯康星'),
('亚利桑那'),
('伊利诺伊大学（香槟校区）'),
('芝加哥'),
('大盐湖'),
('科罗拉多'),
('萨克拉门托'),
('埃德蒙顿'),
('卡尔加里'),
('蒙特利尔'),
('南安省'),
('温哥华'),
('渥太华');

-- Drop table

-- DROP TABLE public.th_department;

CREATE TABLE public.th_department (
	id serial NOT NULL,
	ename text NULL,
    cname text NULL,
	points integer default 0,
	CONSTRAINT th_department_pkey PRIMARY KEY (id)
);

INSERT INTO public.th_department (cname) VALUES
('人文学院'),
('化学系'),
('化工系'),
('医学院'),
('土木系'),
('工业工程系'),
('工物系'),
('建筑学院'),
('数学系'),
('机械系'),
('材料系'),
('水利系'),
('汽车系'),
('法学院'),
('热能系'),
('物理系'),
('环境学院'),
('生命学院'),
('电子系'),
('电机系'),
('社科学院'),
('精仪系'),
('经管学院'),
('自动化系'),
('航天航空学院'),
('计算机系'),
('软件学院');


-- Drop table

-- DROP TABLE public.tournament;

CREATE TABLE public.tournament (
	id serial NOT NULL,
	ename text NULL,
	cname text NULL,
	status smallint NULL
);


-- Drop table

-- DROP TABLE public.player;

CREATE TABLE public.player (
	id serial NOT NULL,
	first_name text NULL,
	last_name text NULL,
	cname text NULL,
	gender text NULL,
	age smallint NULL,
	email text NULL,
	wechat_id text NULL,
	phone text NULL,
    th_department_id integer NULL,
	th_department_name text NULL,
	th_association_id integer NULL,
    th_association_name text NULL,
	sport_id integer NULL,
	attendee_no bigint NULL,
	level smallint NULL,
	status smallint NOT NULL DEFAULT 0,
	points integer default 0,
	CONSTRAINT player_pkey PRIMARY KEY (id)
);

-- Drop table

-- DROP TABLE public.team;

CREATE TABLE public.team (
	id serial NOT NULL,
	uuid text NULL,
	team_name text NULL,
	sport_id integer NULL,
    event_id integer NULL,
    tournament_id integer NULL,
    score text NULL,
	rank integer NULL,
    points integer default 0,
	note text NULL,
	status smallint NOT NULL default 0,
	CONSTRAINT team_pkey PRIMARY KEY (id)
);

CREATE TABLE public.team_player (
	id serial NOT NULL,
	team_id integer NULL,
    player_id integer NULL,
	CONSTRAINT team_player_pkey PRIMARY KEY (id)
);


-- Drop table

-- DROP TABLE public.match;

CREATE TABLE public.match (
	id serial NOT NULL,
	sport_id integer NULL,
	event_id integer NULL,
	court_id integer NULL,
	round integer NULL,
	start_time timestamptz NULL,
	end_time timestamptz NULL,
	CONSTRAINT match_pkey PRIMARY KEY (id)
);


CREATE TABLE public.match_team (
	id serial NOT NULL,
    match_id integer NULL,
	team_id integer NULL,
    score1 int2 NULL,
    score2 int2 NULL, 
    score3 int2 NULL,
	match_points int2 NULL,
	set_points int2 NULL,
	small_points int2 NULL,
	CONSTRAINT match_team_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_detail (
	id serial NOT NULL,
	user_name text NULL,
	password text NULL,
	user_type text NULL,
	sport_id integer NULL,
	CONSTRAINT user_detail_pkey PRIMARY KEY (id)
);

INSERT INTO public.user_detail (id, user_name, user_type, sport_id) VALUES 
(1, 'Running','admin', 1),
(2, 'Golf','admin', 2),
(3, 'Badminton','admin', 3),
(4, 'Tennis','admin', 4),
(5, 'Pingpang','admin', 5),
(6, 'ops', 'ops', NULL),
(7, 'Tsinghua', 'guest', NULL);

COMMIT;
