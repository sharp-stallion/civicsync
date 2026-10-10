-- ============================================================================
-- CivicSync — South Chennai PILOT SEED (synthetic but realistic).
-- Apply LAST, after schema.sql, functions.sql, policies.sql.
--
-- Every row here is sample data for the pilot. Titles and descriptions say so.
-- Do NOT present these as genuine municipal works. Replace with reviewed local
-- data before any real deployment. Coordinates are real South Chennai points;
-- schedules, costs and contractors are invented for demonstration.
--
-- Inserting these projects fires the Dig-Once trigger, so conflicts are
-- generated automatically — exactly as they will be in production.
-- ============================================================================

insert into public.departments(id, name, contact_email, contact_phone) values
 ('d1000000-0000-4000-8000-000000000001','Greater Chennai Corporation','roads@example.chennai.gov','+91-44-2538-0001'),
 ('d1000000-0000-4000-8000-000000000002','Metrowater (CMWSSB)','water@example.chennai.gov','+91-44-4567-0002'),
 ('d1000000-0000-4000-8000-000000000003','TANGEDCO (Electricity)','power@example.chennai.gov','+91-44-2851-0003'),
 ('d1000000-0000-4000-8000-000000000004','BSNL / Telecom','telecom@example.chennai.gov','+91-44-2847-0004'),
 ('d1000000-0000-4000-8000-000000000005','TN Urban Infrastructure (Stormwater)','storm@example.chennai.gov','+91-44-2231-0005')
on conflict (id) do update set name = excluded.name;

-- ---- Adyar cluster: the Dig-Once showcase (shared segment SC-ADYAR-1STMAIN-03)
insert into public.projects(id,title,description,road_name,road_segment_id,location_description,latitude,longitude,work_type,department_id,start_date,end_date,status,progress_percent,contractor_name,estimated_cost_inr) values
 ('a1000000-0000-4000-8000-000000000001','[Pilot] Resurfacing — 1st Main Road, Adyar','Sample data. Full-width bitumen resurfacing between the Adyar signal and the BSNL exchange.','1st Main Road, Adyar','SC-ADYAR-1STMAIN-03','Adyar signal to BSNL exchange',13.0012,80.2565,'road_repair','d1000000-0000-4000-8000-000000000001',current_date + 3,current_date + 33,'planned',0,'SampleBuild Infra Pvt Ltd',4200000),
 ('a1000000-0000-4000-8000-000000000002','[Pilot] Water main replacement — 1st Main Road, Adyar','Sample data. Replacing a corroded 300mm water main.','1st Main Road, Adyar','SC-ADYAR-1STMAIN-03','Near Adyar signal',13.0014,80.2566,'water_pipeline','d1000000-0000-4000-8000-000000000002',current_date + 12,current_date + 26,'planned',0,'AquaWorks Demo Co',2600000),
 ('a1000000-0000-4000-8000-000000000003','[Pilot] Fibre trenching — 1st Main Road, Adyar','Sample data. Micro-trenching for an FTTH backbone, scheduled soon after the resurfacing above.','1st Main Road, Adyar','SC-ADYAR-1STMAIN-03','Along the resurfaced stretch',13.0016,80.2567,'telecom','d1000000-0000-4000-8000-000000000004',current_date + 95,current_date + 112,'planned',0,'FibreDemo Networks',900000)
on conflict (id) do nothing;

-- ---- Velachery cluster (shared segment SC-VLCY-100FT-07)
insert into public.projects(id,title,description,road_name,road_segment_id,location_description,latitude,longitude,work_type,department_id,start_date,end_date,revised_end_date,status,progress_percent,contractor_name,estimated_cost_inr) values
 ('a1000000-0000-4000-8000-000000000004','[Pilot] Stormwater drain — 100 Feet Road, Velachery','Sample data. New stormwater drain; delayed by the monsoon.','100 Feet Road, Velachery','SC-VLCY-100FT-07','Velachery MRTS to Vijayanagar',12.9791,80.2210,'stormwater','d1000000-0000-4000-8000-000000000005',current_date - 60,current_date - 5,current_date + 25,'delayed',55,'StormDemo Builders',7800000),
 ('a1000000-0000-4000-8000-000000000005','[Pilot] HT cable laying — 100 Feet Road, Velachery','Sample data. High-tension cable laying overlapping the drain works.','100 Feet Road, Velachery','SC-VLCY-100FT-07','Near Vijayanagar bus stand',12.9793,80.2212,'electricity','d1000000-0000-4000-8000-000000000003',current_date + 2,current_date + 22,null,'planned',0,'PowerDemo Pvt Ltd',3100000)
on conflict (id) do nothing;

-- ---- Standalone works across South Chennai (map spread + scoreboard data)
insert into public.projects(id,title,description,road_name,location_description,latitude,longitude,work_type,department_id,start_date,end_date,actual_end_date,status,progress_percent,contractor_name,estimated_cost_inr) values
 ('a1000000-0000-4000-8000-000000000006','[Pilot] Sewer rehabilitation — OMR, Thoraipakkam','Sample data. Trenchless sewer rehabilitation on the OMR service road.','OMR Service Road, Thoraipakkam','Near Thoraipakkam toll',12.9400,80.2340,'sewer_drainage','d1000000-0000-4000-8000-000000000002',current_date - 20,current_date + 40,null,'ongoing',45,'SewerDemo Infra',5400000),
 ('a1000000-0000-4000-8000-000000000007','[Pilot] Junction resurfacing — Kathipara, Guindy','Sample data. Completed on schedule.','Mount Road, Guindy','Kathipara junction approach',13.0100,80.2210,'road_repair','d1000000-0000-4000-8000-000000000001',current_date - 90,current_date - 40,current_date - 42,'completed',100,'SampleBuild Infra Pvt Ltd',6100000),
 ('a1000000-0000-4000-8000-000000000008','[Pilot] Gas pipeline — Elliots Beach Road, Besant Nagar','Sample data. City gas distribution pipeline.','Elliots Beach Road, Besant Nagar','Near Ashtalakshmi temple',12.9980,80.2670,'gas','d1000000-0000-4000-8000-000000000005',current_date + 15,current_date + 60,null,'planned',0,'GasDemo Utilities',4700000),
 ('a1000000-0000-4000-8000-000000000009','[Pilot] Service road resurfacing — ECR, Thiruvanmiyur','Sample data. Completed 18 days late.','ECR Service Road, Thiruvanmiyur','Near Thiruvanmiyur bus depot',12.9830,80.2594,'road_repair','d1000000-0000-4000-8000-000000000001',current_date - 120,current_date - 70,current_date - 52,'completed',100,'CoastDemo Roads',5200000),
 ('a1000000-0000-4000-8000-00000000000a','[Pilot] Water pipeline — OMR, Sholinganallur','Sample data. Ongoing trunk main extension.','OMR, Sholinganallur','Near Sholinganallur junction',12.9009,80.2279,'water_pipeline','d1000000-0000-4000-8000-000000000002',current_date - 10,current_date + 50,null,'ongoing',30,'AquaWorks Demo Co',8900000)
on conflict (id) do nothing;

-- ---- GST Road corridor (Tambaram → Vandalur → Guduvanchery)
-- Perungalathur pair shares a segment and overlaps → one schedule_overlap.
insert into public.projects(id,title,description,road_name,road_segment_id,location_description,latitude,longitude,work_type,department_id,start_date,end_date,status,progress_percent,contractor_name,estimated_cost_inr) values
 ('a1000000-0000-4000-8000-00000000000b','[Pilot] GST Road resurfacing — Perungalathur','Sample data. Carriageway resurfacing on the GST Road service lane near Perungalathur.','GST Road, Perungalathur','SC-GST-PERUNGALATHUR-01','Near Perungalathur railway station',12.9065,80.0943,'road_repair','d1000000-0000-4000-8000-000000000001',current_date + 5,current_date + 35,'planned',0,'SampleBuild Infra Pvt Ltd',6800000),
 ('a1000000-0000-4000-8000-00000000000c','[Pilot] Water pipeline — Perungalathur (GST Road)','Sample data. Trunk main tie-in overlapping the resurfacing above.','GST Road, Perungalathur','SC-GST-PERUNGALATHUR-01','Near Perungalathur bus stop',12.9067,80.0945,'water_pipeline','d1000000-0000-4000-8000-000000000002',current_date + 14,current_date + 28,'planned',0,'AquaWorks Demo Co',3300000),
 ('a1000000-0000-4000-8000-00000000000d','[Pilot] Stormwater drain — Guduvanchery (GST Road)','Sample data. New roadside stormwater drain along the GST Road.','GST Road, Guduvanchery','SC-GST-GUDUVANCHERY-02','Near Guduvanchery railway station',12.8440,80.0590,'stormwater','d1000000-0000-4000-8000-000000000005',current_date - 8,current_date + 44,'ongoing',25,'StormDemo Builders',5900000),
 ('a1000000-0000-4000-8000-00000000000e','[Pilot] Sewer line — Vandalur','Sample data. Branch sewer line near the Vandalur junction.','GST Road, Vandalur','SC-GST-VANDALUR-03','Near Vandalur zoo junction',12.8916,80.0810,'sewer_drainage','d1000000-0000-4000-8000-000000000002',current_date + 20,current_date + 70,'planned',0,'SewerDemo Infra',4100000)
on conflict (id) do nothing;

-- ---- A couple of public timeline updates (demonstrate history + status sync)
insert into public.project_updates(project_id,status,progress_percent,progress_note,delay_reason,revised_end_date)
select 'a1000000-0000-4000-8000-000000000004','delayed',55,'Excavation paused during heavy rain; pumping out the trench before resuming.','Monsoon flooding of the open trench.',current_date + 25
where not exists (select 1 from public.project_updates where project_id='a1000000-0000-4000-8000-000000000004');

insert into public.project_updates(project_id,status,progress_percent,progress_note)
select 'a1000000-0000-4000-8000-000000000006','ongoing',45,'Liner installation complete on the first 300 m; manhole restoration underway.'
where not exists (select 1 from public.project_updates where project_id='a1000000-0000-4000-8000-000000000006');

-- Ensure conflicts are computed for every seeded project (triggers already ran,
-- but this is safe and idempotent if the seed is re-applied).
do $$ declare r record; begin
  for r in select id from public.projects loop
    perform public.detect_conflicts_for_project(r.id);
  end loop;
  perform public.clear_stale_conflicts();
end $$;
