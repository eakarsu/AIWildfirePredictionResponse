require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create tables
    await client.query(`
      DROP TABLE IF EXISTS equipment_tracking CASCADE;
      DROP TABLE IF EXISTS crew_deployments CASCADE;
      DROP TABLE IF EXISTS water_sources CASCADE;
      DROP TABLE IF EXISTS spread_predictions CASCADE;
      DROP TABLE IF EXISTS damage_assessments CASCADE;
      DROP TABLE IF EXISTS community_alerts CASCADE;
      DROP TABLE IF EXISTS smoke_reports CASCADE;
      DROP TABLE IF EXISTS weather_analyses CASCADE;
      DROP TABLE IF EXISTS resource_allocations CASCADE;
      DROP TABLE IF EXISTS evacuation_plans CASCADE;
      DROP TABLE IF EXISTS fire_detections CASCADE;
      DROP TABLE IF EXISTS risk_assessments CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'analyst',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE risk_assessments (
        id SERIAL PRIMARY KEY,
        location VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        vegetation_type VARCHAR(100),
        terrain VARCHAR(100),
        weather_conditions TEXT,
        risk_level VARCHAR(50) DEFAULT 'Pending',
        risk_score INTEGER DEFAULT 0,
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE fire_detections (
        id SERIAL PRIMARY KEY,
        location VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        sensor_type VARCHAR(100),
        confidence_level INTEGER,
        temperature DECIMAL(6,1),
        satellite_source VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Active',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        detected_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE evacuation_plans (
        id SERIAL PRIMARY KEY,
        zone_name VARCHAR(255) NOT NULL,
        population INTEGER,
        primary_route TEXT,
        secondary_route TEXT,
        assembly_point VARCHAR(255),
        special_needs_count INTEGER DEFAULT 0,
        vehicles_estimated INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Draft',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE resource_allocations (
        id SERIAL PRIMARY KEY,
        incident_name VARCHAR(255) NOT NULL,
        resource_type VARCHAR(100),
        quantity INTEGER,
        location VARCHAR(255),
        priority VARCHAR(50),
        estimated_cost DECIMAL(12,2),
        status VARCHAR(50) DEFAULT 'Pending',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE weather_analyses (
        id SERIAL PRIMARY KEY,
        location VARCHAR(255) NOT NULL,
        temperature DECIMAL(5,1),
        humidity DECIMAL(5,1),
        wind_speed DECIMAL(5,1),
        wind_direction VARCHAR(20),
        precipitation DECIMAL(5,2),
        forecast_period VARCHAR(50),
        fire_weather_index DECIMAL(5,1) DEFAULT 0,
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE smoke_reports (
        id SERIAL PRIMARY KEY,
        location VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        smoke_color VARCHAR(50),
        smoke_density VARCHAR(50),
        wind_direction VARCHAR(50),
        reporter_name VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Reported',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE community_alerts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        alert_type VARCHAR(100),
        severity VARCHAR(50),
        affected_area VARCHAR(255),
        population_affected INTEGER,
        message TEXT,
        status VARCHAR(50) DEFAULT 'Draft',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE damage_assessments (
        id SERIAL PRIMARY KEY,
        incident_name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        acres_burned DECIMAL(10,1),
        structures_damaged INTEGER DEFAULT 0,
        structures_destroyed INTEGER DEFAULT 0,
        estimated_cost DECIMAL(14,2),
        injuries INTEGER DEFAULT 0,
        fatalities INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'In Progress',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE spread_predictions (
        id SERIAL PRIMARY KEY,
        fire_name VARCHAR(255) NOT NULL,
        current_acres DECIMAL(10,1),
        wind_speed DECIMAL(5,1),
        wind_direction VARCHAR(20),
        terrain_type VARCHAR(100),
        vegetation_density VARCHAR(50),
        humidity DECIMAL(5,1),
        temperature DECIMAL(5,1),
        status VARCHAR(50) DEFAULT 'Active',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE water_sources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        source_type VARCHAR(100),
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        capacity_gallons INTEGER,
        accessibility VARCHAR(100),
        road_access VARCHAR(100),
        helicopter_accessible BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'Available',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE crew_deployments (
        id SERIAL PRIMARY KEY,
        crew_name VARCHAR(255) NOT NULL,
        crew_size INTEGER,
        specialization VARCHAR(100),
        assigned_incident VARCHAR(255),
        deployment_location VARCHAR(255),
        shift_start TIMESTAMP,
        shift_end TIMESTAMP,
        fatigue_level VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Deployed',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE equipment_tracking (
        id SERIAL PRIMARY KEY,
        equipment_name VARCHAR(255) NOT NULL,
        equipment_type VARCHAR(100),
        serial_number VARCHAR(100),
        current_location VARCHAR(255),
        condition VARCHAR(50),
        last_maintenance DATE,
        hours_used INTEGER DEFAULT 0,
        assigned_to VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Operational',
        ai_analysis TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed users
    const hash = await bcrypt.hash('password123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
      ('Admin User', 'admin@wildfire.gov', $1, 'admin'),
      ('John Smith', 'john@wildfire.gov', $1, 'commander'),
      ('Sarah Johnson', 'sarah@wildfire.gov', $1, 'analyst')
    `, [hash]);

    // Seed risk assessments (15 items)
    await client.query(`
      INSERT INTO risk_assessments (location, latitude, longitude, vegetation_type, terrain, weather_conditions, risk_level, risk_score, ai_analysis, created_by) VALUES
      ('Angeles National Forest, CA', 34.2500, -118.1500, 'Chaparral', 'Steep canyon', 'Hot, dry, Santa Ana winds expected', 'Critical', 95, 'Critical fire risk due to Santa Ana wind conditions combined with dense chaparral fuel load. The steep canyon terrain will accelerate fire spread. Recommend pre-positioning resources and issuing red flag warnings.', 1),
      ('Yosemite Valley, CA', 37.7459, -119.5332, 'Mixed conifer', 'Valley floor', 'Moderate temps, low humidity', 'High', 78, 'High risk in mixed conifer stands with accumulated dead fuel. Valley topography may channel winds. Historical fire data shows increased risk in late summer.', 1),
      ('Coconino National Forest, AZ', 35.1983, -111.6513, 'Ponderosa pine', 'Rolling hills', 'Dry conditions, moderate winds', 'High', 72, 'Ponderosa pine forests with grass understory present significant risk during dry conditions. Moderate winds could drive surface fires into crown fires.', 1),
      ('Boise National Forest, ID', 43.8007, -115.7810, 'Mixed forest', 'Mountainous', 'Thunderstorm activity expected', 'Medium', 55, 'Lightning strikes from expected thunderstorms pose ignition risk. Mixed forest fuels are moderately dry. Mountainous terrain complicates suppression.', 1),
      ('Prescott National Forest, AZ', 34.5400, -112.4685, 'Juniper-pinyon', 'Mesa and canyon', 'Extended drought conditions', 'Critical', 92, 'Extended drought has critically reduced fuel moisture. Juniper-pinyon woodland is highly flammable. Canyon winds could produce extreme fire behavior.', 1),
      ('Sequoia National Forest, CA', 36.4864, -118.5658, 'Giant sequoia grove', 'Mountain slope', 'Warm, dry, gusty winds', 'High', 82, 'Giant sequoia groves at elevated risk. While mature sequoias are fire-resistant, surrounding understory fuels pose threat. Gusty winds increase spot fire potential.', 1),
      ('Gila National Forest, NM', 33.2300, -108.5300, 'Ponderosa/mixed', 'Rugged mountain', 'Very low humidity, high temps', 'High', 76, 'Very low humidity combined with high temperatures create dangerous fire conditions. Rugged terrain limits access for suppression crews.', 1),
      ('Pike National Forest, CO', 39.0000, -105.2500, 'Lodgepole pine', 'Mountain slopes', 'Red flag conditions', 'Critical', 88, 'Red flag conditions with extreme fire danger. Beetle-killed lodgepole pine provides abundant dead fuel. Mountain slopes will increase rate of spread.', 1),
      ('Mark Twain National Forest, MO', 37.4000, -91.5000, 'Oak-hickory', 'Ozark hills', 'Spring drought, low humidity', 'Medium', 48, 'Spring drought conditions in oak-hickory forest. Leaf litter accumulation provides surface fuel. Moderate risk for prescribed fire escapes.', 1),
      ('Okanogan-Wenatchee NF, WA', 47.8000, -120.7000, 'Douglas fir', 'Cascade slopes', 'Hot, dry east wind event', 'Critical', 91, 'East wind event will push hot, dry air over Cascade slopes. Douglas fir stands with ladder fuels enable crown fire. Multiple communities in fire path.', 1),
      ('Shasta-Trinity NF, CA', 40.8000, -122.5000, 'Mixed conifer', 'Mountain terrain', 'Extreme heat wave', 'High', 80, 'Extreme heat wave drying fuels rapidly. Mixed conifer forests at elevation are becoming critically dry. Multiple river canyons could channel fire.', 1),
      ('Tonto National Forest, AZ', 33.6500, -111.1500, 'Desert scrub/grass', 'Desert mountain', 'Monsoon season approaching', 'Medium', 52, 'Pre-monsoon conditions with dried grass from winter rains. Desert scrub provides flashy fuels. Monsoon storms may bring lightning before rain.', 1),
      ('San Bernardino NF, CA', 34.1700, -117.0000, 'Chaparral/sage', 'Steep mountains', 'Santa Ana wind watch', 'Critical', 94, 'Santa Ana wind watch issued. Extremely dense chaparral on steep slopes. Urban-wildland interface extensive. Critical fire weather approaching.', 1),
      ('Flathead National Forest, MT', 48.2000, -114.0000, 'Subalpine fir', 'Alpine/subalpine', 'Seasonal drought', 'Low', 35, 'Seasonal drought in subalpine zone. Fuel moisture still above critical threshold. Snow melt recent. Lower risk but monitoring recommended.', 1),
      ('Ocala National Forest, FL', 29.1800, -81.6500, 'Sand pine scrub', 'Flat terrain', 'Winter dry season', 'Medium', 58, 'Winter dry season in sand pine scrub. Flash fuels respond quickly to low humidity. Flat terrain allows rapid fire spread. Prescribed fire season active.', 1)
    `);

    // Seed fire detections (15 items)
    await client.query(`
      INSERT INTO fire_detections (location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, status, ai_analysis, created_by) VALUES
      ('Bear Creek Canyon, CA', 34.2100, -118.2200, 'VIIRS', 95, 450.5, 'NOAA-20', 'Active', 'High-confidence detection with VIIRS thermal anomaly. Temperature of 450°F indicates active combustion. Terrain analysis suggests fire in chaparral-covered canyon.', 1),
      ('Pine Valley, AZ', 34.5600, -112.3400, 'MODIS', 88, 380.2, 'Terra', 'Active', 'MODIS detection with high confidence. Temperature pattern consistent with surface fire in pine-grassland interface. Wind could drive rapid spread.', 1),
      ('Elk Ridge, CO', 39.1200, -105.3100, 'GOES-16', 72, 320.0, 'GOES-West', 'Investigating', 'Moderate confidence detection from geostationary satellite. Could be agricultural burn or wildfire. Ground verification recommended.', 1),
      ('Rattlesnake Peak, NM', 33.4500, -108.2100, 'VIIRS', 91, 415.8, 'Suomi NPP', 'Active', 'High-confidence thermal detection in remote wilderness area. Likely lightning-caused ignition. Limited access for ground crews.', 1),
      ('Cedar Flat, OR', 42.3000, -122.8000, 'MODIS', 85, 365.3, 'Aqua', 'Contained', 'Confirmed wildfire, now contained. MODIS showing decreasing thermal signature. Continued monitoring for hotspot flare-ups recommended.', 1),
      ('Thompson Ridge, MT', 47.5000, -113.8000, 'VIIRS', 68, 290.0, 'NOAA-20', 'False Alarm', 'Investigation revealed industrial activity. Thermal signature inconsistent with wildfire. Low confidence from initial detection.', 1),
      ('Manzanita Canyon, CA', 33.9800, -117.2500, 'GOES-16', 94, 520.0, 'GOES-West', 'Active', 'Very high confidence detection with extreme temperature. Multiple pixels showing thermal anomaly. Rapid response required. Urban interface threatened.', 1),
      ('Blue Mountain, WA', 46.2000, -117.5000, 'VIIRS', 78, 340.5, 'Suomi NPP', 'Monitoring', 'Moderate detection in wheat stubble area. Could be agricultural burning or escaped fire. Ground verification dispatched.', 1),
      ('Granite Creek, ID', 44.1000, -115.2000, 'MODIS', 90, 405.0, 'Terra', 'Active', 'High-confidence detection in remote wilderness. Multiple MODIS passes confirm persistent heat source. Lightning was reported in area 48 hours ago.', 1),
      ('Sunrise Peak, AZ', 33.7800, -109.8900, 'VIIRS', 82, 355.7, 'NOAA-20', 'Investigating', 'Detection in Apache-Sitgreaves NF. Temperature suggests developing fire. Terrain analysis shows steep, inaccessible slope.', 1),
      ('Lost Creek, CO', 39.3500, -105.5000, 'GOES-16', 96, 480.0, 'GOES-West', 'Active', 'Highest confidence detection. Rapid temperature increase over 2-hour period. Fire growing rapidly. Smoke plume visible on visible imagery.', 1),
      ('Willow Springs, NV', 39.8000, -117.3000, 'MODIS', 75, 310.0, 'Aqua', 'Monitoring', 'Moderate detection in sagebrush steppe. Low population area. May be managed fire or natural ignition. Monitoring continues.', 1),
      ('Eagle Point, CA', 38.5000, -120.2000, 'VIIRS', 93, 430.0, 'NOAA-20', 'Active', 'High-confidence in El Dorado NF. Temperature indicates established fire. CAL FIRE notified. Air tankers requested.', 1),
      ('Haystack Butte, OR', 44.7000, -121.3000, 'MODIS', 60, 275.0, 'Terra', 'False Alarm', 'Low confidence detection. Investigation showed sun glint on metal roof. Thermal signature does not match wildfire profile.', 1),
      ('Rim Rock, UT', 37.6000, -112.2000, 'VIIRS', 87, 390.0, 'Suomi NPP', 'Contained', 'Fire detected and confirmed. Rapid initial attack achieved containment. Monitoring for spot fires outside containment line.', 1)
    `);

    // Seed evacuation plans (15 items)
    await client.query(`
      INSERT INTO evacuation_plans (zone_name, population, primary_route, secondary_route, assembly_point, special_needs_count, vehicles_estimated, status, ai_analysis, created_by) VALUES
      ('Paradise Hills Zone A', 12500, 'Skyway Road south to Hwy 99', 'Clark Road to Hwy 32', 'Chico Fairgrounds', 340, 5200, 'Active', 'Primary route capacity adequate for Zone A population. Recommend staggered departure times. Special needs transport requires 12 paratransit vehicles.', 1),
      ('Mountain View Estates', 3200, 'Mountain View Dr to I-15', 'Ridge Road to County Rd 4', 'Valley Community Center', 85, 1400, 'Active', 'Two viable routes provide good redundancy. Assembly point has adequate parking and facilities. Medical staff needed for special needs evacuees.', 1),
      ('Timber Ridge Community', 8900, 'Timber Road to State Route 44', 'Forest Highway 22 north', 'Red Bluff High School', 210, 3800, 'Draft', 'Single lane sections on primary route may cause bottlenecks. Recommend traffic control at 3 intersections. Estimated evacuation time: 4.5 hours.', 1),
      ('Lakeside Village', 5600, 'Lakeshore Drive to Hwy 89', 'Back Bay Road to County 12', 'Susanville Fairgrounds', 145, 2300, 'Active', 'Lakeshore Drive provides scenic but narrow evacuation corridor. Recommend contra-flow on Hwy 89 during major evacuation. Assembly point 22 miles from zone.', 1),
      ('Cedar Canyon Subdivision', 2100, 'Cedar Canyon Rd to Main St', 'Fire Road 7 (4WD only)', 'Downtown Community Hall', 55, 900, 'Draft', 'Limited secondary route restricts evacuation options. Fire Road 7 only suitable for 4WD vehicles. Recommend helicopter evacuation plan for mobility-impaired.', 1),
      ('Pine Forest Acres', 4500, 'Pine Forest Blvd to I-5', 'Old Mill Road to Hwy 97', 'Medford Expo Center', 120, 1900, 'Active', 'Good road network provides multiple options. I-5 access enables rapid evacuation. Estimated time to clear zone: 2.5 hours under normal conditions.', 1),
      ('Eagle Rock Heights', 7800, 'Eagle Rock Dr to Hwy 18', 'Summit Road to Big Bear', 'San Bernardino NOS Center', 195, 3300, 'Active', 'Mountain community with limited egress. Two routes may be impacted by same fire. Recommend early evacuation trigger. 45-minute travel to assembly.', 1),
      ('Riverside Ranch Estates', 1800, 'Ranch Road to County Rd 22', 'Riverbed access road', 'Riverside School', 42, 800, 'Draft', 'Small community with good primary route. Secondary route crosses seasonal creek. Recommend bridge inspection before fire season. Short evacuation time.', 1),
      ('Summit View Community', 6200, 'Summit Parkway to Hwy 50', 'Pony Express Trail', 'Placerville Fairgrounds', 168, 2600, 'Active', 'Summit Parkway well-maintained with adequate capacity. Pony Express Trail adds 20 minutes but avoids fire-prone corridor. Zone alerts linked to CAL FIRE.', 1),
      ('Wildwood Terrace', 3400, 'Wildwood Blvd to Foothill Rd', 'Canyon Creek Trail to Hwy 3', 'Redding Convention Center', 90, 1500, 'Active', 'Dense suburban area requires efficient traffic management. School zone timing may conflict with evacuation. Recommend shelter-in-place option for Zone B.', 1),
      ('High Desert Ranch', 950, 'Desert Ranch Rd to US-395', 'BLM Road 112', 'Bishop Fire Station', 25, 420, 'Draft', 'Remote community with long evacuation distances. BLM road unmaintained. Satellite phone communication only. Recommend emergency supply cache on-site.', 1),
      ('Cascade Meadows', 4100, 'Meadow Lane to State Route 20', 'Logging Road 445 to Hwy 89', 'Nevada City Fairgrounds', 108, 1700, 'Active', 'Two viable routes through forested terrain. Both routes traverse fire-prone areas. Recommend trigger points based on fire location. 3-hour full evacuation.', 1),
      ('Oakridge Community', 5500, 'Oakridge Parkway to Hwy 58', 'Salmon Creek Rd to I-5', 'Eugene Fairgrounds', 140, 2300, 'Active', 'Well-planned community with fire-resistant construction. Good road network. Eugene fairgrounds 45 minutes away. Coordinate with Lane County Emergency Mgmt.', 1),
      ('Bear Valley Village', 2800, 'Bear Valley Rd to Hwy 4', 'Bloods Ridge Rd (seasonal)', 'Arnold Community Center', 72, 1200, 'Draft', 'High elevation community with winter road closures. Bloods Ridge Rd closed Nov-May. Single viable route during winter creates vulnerability. Early warning critical.', 1),
      ('Foothill Gardens', 9200, 'Foothill Blvd to I-210', 'Angeles Crest Hwy to Hwy 2', 'Rose Bowl, Pasadena', 245, 3900, 'Active', 'Large urban-wildland interface community. I-210 provides high-capacity evacuation. Angeles Crest may be compromised by fire. Rose Bowl can shelter 10,000+.', 1)
    `);

    // Seed resource allocations (15 items)
    await client.query(`
      INSERT INTO resource_allocations (incident_name, resource_type, quantity, location, priority, estimated_cost, status, ai_analysis, created_by) VALUES
      ('Riverside Fire', 'Type 1 Engine', 12, 'Riverside County, CA', 'Critical', 480000.00, 'Deployed', 'Optimal deployment of 12 Type 1 engines for structure protection along urban-wildland interface. Staging at 3 locations recommended for rapid response.', 1),
      ('Blue Ridge Fire', 'Hotshot Crew', 4, 'San Bernardino NF, CA', 'High', 320000.00, 'Deployed', '4 hotshot crews provide adequate handline capability for initial containment. Deploy along southeast flank for containment line construction.', 1),
      ('Granite Peak Fire', 'Air Tanker (VLAT)', 2, 'Boise NF, ID', 'Critical', 850000.00, 'Requested', 'VLAT deployment critical for slowing fire advance toward community. Estimated 4 drops needed for effective retardant line. Coordinate with ground crews.', 1),
      ('Cedar Creek Fire', 'Water Tender', 8, 'Deschutes NF, OR', 'High', 160000.00, 'En Route', 'Water tenders needed for engine support in remote areas. Limited hydrant access requires mobile water supply. Position at 2-mile intervals along fire line.', 1),
      ('Thompson Fire', 'Helicopter (Type 1)', 3, 'Flathead NF, MT', 'Critical', 720000.00, 'Deployed', 'Type 1 helicopters essential for bucket drops in steep terrain. Night operations capability needed. Helibase established at Thompson Falls airport.', 1),
      ('Sunrise Fire', 'Dozer (Type 2)', 5, 'Apache-Sitgreaves NF, AZ', 'Medium', 250000.00, 'Deployed', 'Dozers clearing containment lines in ponderosa pine. Type 2 appropriate for moderate terrain. Avoid designated wilderness areas per forest plan.', 1),
      ('Eagle Fire', 'Strike Team (Engine)', 3, 'El Dorado NF, CA', 'High', 540000.00, 'Deployed', '3 strike teams providing structure protection for 200+ homes. Coordinate with local fire departments. Establish water supply points along Ridge Road.', 1),
      ('Pine Flat Fire', 'Smokejumper Team', 2, 'Nez Perce NF, ID', 'Medium', 180000.00, 'Completed', 'Smokejumper initial attack successful. Fire held at 5 acres. Transitioning to ground crew mop-up. Exemplary rapid response.', 1),
      ('Desert Wind Fire', 'Hand Crew (Type 2)', 6, 'Mojave Desert, CA', 'High', 270000.00, 'Deployed', '6 hand crews constructing fireline in desert scrub. Heat stress protocols mandatory. Hydration stations every 0.5 miles. Night shift operations preferred.', 1),
      ('Cascade Fire', 'Mobile Command', 1, 'Wenatchee NF, WA', 'High', 95000.00, 'Deployed', 'Mobile command post established at junction of FR-22 and Hwy 97. Communications relay installed. Briefing area supports 200 personnel.', 1),
      ('Valley Fire', 'Medical Unit', 2, 'Lake County, CA', 'Critical', 120000.00, 'Deployed', 'Two medical units positioned at division break and base camp. ALS capability with helicopter medevac standing by. Heat injury treatment focus.', 1),
      ('Summit Fire', 'Infrared Mapping', 1, 'Sequoia NF, CA', 'Medium', 45000.00, 'Completed', 'IR mapping flight completed. Fire perimeter mapped at 2,340 acres. Hot spots identified along NE flank. Data integrated into GIS operations map.', 1),
      ('Wildcat Fire', 'Fuel Break Crew', 4, 'Cleveland NF, CA', 'High', 200000.00, 'Deployed', 'Fuel break construction crews working on pre-identified strategic fuel breaks. Priority on protecting I-15 corridor and communities along Hwy 76.', 1),
      ('Thunder Fire', 'Weather Station (RAWS)', 3, 'Gila NF, NM', 'Medium', 15000.00, 'Deployed', 'Three portable RAWS deployed to monitor micro-climate conditions. Data feeding into fire behavior prediction models. Critical for night operations planning.', 1),
      ('Rim Fire', 'Base Camp Support', 1, 'Stanislaus NF, CA', 'High', 350000.00, 'Deployed', 'Full base camp supporting 2,500 personnel. Catering, sleeping, showers, and equipment maintenance. Located at Pine Mountain Lake airport.', 1)
    `);

    // Seed weather analyses (15 items)
    await client.query(`
      INSERT INTO weather_analyses (location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, fire_weather_index, ai_analysis, created_by) VALUES
      ('Los Angeles Basin, CA', 105.0, 8.0, 45.0, 'NE', 0.00, '24-hour', 98.5, 'EXTREME fire weather. Santa Ana conditions with single-digit humidity and 45mph gusts. Red Flag Warning in effect. All outdoor burning prohibited. Pre-position resources.', 1),
      ('Boise Valley, ID', 92.0, 22.0, 15.0, 'SW', 0.00, '48-hour', 72.0, 'HIGH fire weather index. Dry conditions with moderate winds. Thunderstorms possible in 36 hours—dry lightning risk. Monitor for new starts.', 1),
      ('Flagstaff Area, AZ', 88.0, 15.0, 20.0, 'W', 0.00, '24-hour', 78.0, 'HIGH fire danger. Below-normal humidity for monsoon season. Gusty afternoon winds expected. Fire weather watch for tomorrow.', 1),
      ('Central Oregon Coast', 68.0, 65.0, 12.0, 'NW', 0.10, '48-hour', 25.0, 'LOW fire danger. Marine influence keeping humidity elevated. Light precipitation expected. Normal fire precautions adequate.', 1),
      ('Denver Front Range, CO', 95.0, 12.0, 35.0, 'W', 0.00, '24-hour', 88.0, 'VERY HIGH fire danger. Chinook wind event drying fuels rapidly. Strong downslope winds through mountain canyons. Red Flag Warning issued.', 1),
      ('Sacramento Valley, CA', 102.0, 10.0, 18.0, 'N', 0.00, '72-hour', 85.0, 'VERY HIGH fire danger. Excessive heat and low humidity. North wind keeping marine layer out. Critical fire weather through weekend.', 1),
      ('Western Montana', 87.0, 28.0, 10.0, 'S', 0.00, '48-hour', 58.0, 'MODERATE fire danger. Seasonal temperatures with below-normal precipitation. Thunderstorm potential increasing. Lightning fire risk moderate.', 1),
      ('Puget Sound, WA', 78.0, 45.0, 8.0, 'NW', 0.05, '24-hour', 32.0, 'LOW-MODERATE fire danger. Typical maritime conditions. East wind event possible next week could elevate risk significantly.', 1),
      ('Phoenix Metro, AZ', 115.0, 5.0, 12.0, 'SE', 0.00, '24-hour', 82.0, 'HIGH fire danger despite urban setting. Extreme heat drying roadside vegetation. Desert fire potential elevated. Monitor utility corridors.', 1),
      ('Reno-Tahoe, NV', 94.0, 14.0, 25.0, 'W', 0.00, '48-hour', 80.0, 'HIGH fire danger. Washoe Zephyr winds increasing. Lake Tahoe basin communities at risk. Critical fire weather watch issued for tomorrow.', 1),
      ('San Diego Backcountry, CA', 98.0, 9.0, 40.0, 'NE', 0.00, '24-hour', 95.0, 'EXTREME fire weather. Santa Ana winds with very low humidity. Multiple red flag warnings. All fire agencies on maximum staffing.', 1),
      ('Missoula Valley, MT', 90.0, 20.0, 15.0, 'SW', 0.00, '72-hour', 68.0, 'HIGH fire danger. Extended dry pattern with above-normal temperatures. Inversions trapping smoke from existing fires. Air quality concerns.', 1),
      ('Prescott-Yavapai, AZ', 96.0, 11.0, 22.0, 'SW', 0.00, '48-hour', 84.0, 'VERY HIGH fire danger. Pre-monsoon conditions with extreme dryness. Afternoon wind gusts expected. Multiple fire starts possible.', 1),
      ('North Cascades, WA', 82.0, 35.0, 10.0, 'E', 0.00, '48-hour', 48.0, 'MODERATE fire danger. East wind event beginning. Humidity dropping. Transition to high fire danger expected within 24 hours. Increase surveillance.', 1),
      ('Tallahassee Region, FL', 92.0, 55.0, 8.0, 'S', 0.25, '24-hour', 38.0, 'LOW-MODERATE fire danger. Typical subtropical conditions. Recent rain keeping fuels moist. Prescribed fire conditions favorable.', 1)
    `);

    // Seed smoke reports (15 items)
    await client.query(`
      INSERT INTO smoke_reports (location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, status, ai_analysis, created_by) VALUES
      ('Highway 38, San Bernardino', 34.0800, -116.9200, 'Gray-white', 'Heavy', 'NE', 'CHP Officer Martinez', 'Large column of smoke visible from Highway 38. Appears to be coming from north slope.', 'Confirmed', 'Gray-white smoke indicates active surface fire with good combustion. Heavy density suggests large fuel involvement. NE wind pushing smoke toward communities.', 1),
      ('Topanga Canyon, CA', 34.0400, -118.6000, 'Dark gray', 'Moderate', 'W', 'Resident J. Park', 'Smoke rising from lower canyon area. Started about 20 minutes ago.', 'Investigating', 'Dark gray smoke suggests incomplete combustion, possibly in heavy brush. Canyon location concerning for rapid fire spread. Immediate investigation recommended.', 1),
      ('Rim of the World, CA', 34.2400, -117.1900, 'White', 'Light', 'SW', 'Forest Ranger Collins', 'Thin smoke column from recreation area. May be illegal campfire.', 'Resolved', 'White smoke indicates small, clean-burning fire. Light density consistent with campfire or small debris pile. Low threat but investigate for fire cause.', 1),
      ('Prescott Basin, AZ', 34.5500, -112.4700, 'Brown-gray', 'Heavy', 'W', 'Yavapai Fire Dispatch', 'Multiple 911 calls reporting heavy smoke in basin area. Growing rapidly.', 'Confirmed', 'Brown-gray smoke indicates surface fire burning through mixed fuels including grass and brush. Heavy density and rapid growth require immediate response.', 1),
      ('Lake Arrowhead, CA', 34.2600, -117.1900, 'Black', 'Very Heavy', 'NE', 'SB County Fire', 'Very dark heavy smoke from residential area near lake. Structure may be involved.', 'Confirmed', 'Black smoke strongly suggests structure involvement or petroleum/rubber fuels. Very heavy density indicates intense fire. Evacuations may be necessary.', 1),
      ('Rogue River Valley, OR', 42.4400, -122.8500, 'White-gray', 'Light', 'N', 'ODF Lookout Tower', 'Small smoke column spotted from lookout. Grid reference OR-042-123. Intermittent.', 'Investigating', 'Intermittent white-gray smoke may indicate smoldering ignition, possibly from lightning. Small and early-stage. Ideal for initial attack success.', 1),
      ('Wenatchee Foothills, WA', 47.4200, -120.3100, 'Gray', 'Moderate', 'E', 'DNR Patrol Unit 7', 'Smoke observed on hillside above Wenatchee. Dry grass area.', 'Confirmed', 'Gray moderate smoke in grass fuels indicates fast-moving surface fire potential. East wind will push fire toward urban area. Rapid response critical.', 1),
      ('Mogollon Rim, AZ', 34.3200, -111.2500, 'Blue-gray', 'Light', 'SW', 'Coconino NF Lookout', 'Very light smoke plume on the rim. Hard to pinpoint exact location.', 'Monitoring', 'Blue-gray light smoke indicates small, well-ventilated fire possibly from lightning. Remote location. May be candidate for monitored management if conditions allow.', 1),
      ('Tehachapi Pass, CA', 35.1300, -118.4500, 'Dark brown', 'Heavy', 'NW', 'Kern County Fire', 'Heavy brown smoke visible from I-58. Appears wind-driven through pass.', 'Confirmed', 'Dark brown heavy smoke indicates fire in heavy brush with high mineral soil content being lofted. Wind-driven through Tehachapi Pass—extreme fire behavior expected.', 1),
      ('McCall Area, ID', 44.9100, -116.1000, 'White', 'Light', 'W', 'Payette NF Spotter', 'Small smoke visible from aerial patrol. Wilderness area, no roads nearby.', 'Monitoring', 'Small white smoke in wilderness. No structures threatened. Monitor for growth. May be appropriate for resource benefit if fire management plan allows.', 1),
      ('Sedona Red Rocks, AZ', 34.8700, -111.7600, 'Gray-white', 'Moderate', 'S', 'Verde Valley Fire', 'Smoke reported near trailhead parking area. Visitors evacuating on their own.', 'Investigating', 'Smoke near high-visitation area requires immediate investigation. South wind pushing smoke toward residential areas. Trail closures recommended.', 1),
      ('Klamath Falls, OR', 42.2000, -121.7300, 'Yellow-gray', 'Heavy', 'NE', 'Klamath County 911', 'Heavy yellowish smoke covering downtown. Source appears to be south of city.', 'Confirmed', 'Yellow tint in smoke may indicate agricultural or grass fire. Heavy concentration creating visibility and air quality hazards. Downtown area should shelter in place.', 1),
      ('Durango Area, CO', 37.2800, -107.8800, 'White-gray', 'Moderate', 'SW', 'La Plata County SO', 'Smoke seen rising from national forest boundary. No lightning reported today.', 'Investigating', 'Human-caused fire likely given no lightning activity. Moderate smoke suggests established fire. Southwest wind could push toward Durango. Investigate cause.', 1),
      ('Grants Pass, OR', 42.4400, -123.3300, 'Light gray', 'Light', 'NW', 'Josephine Co. Fire', 'Thin smoke column from riverside area. May be permitted burn.', 'Resolved', 'Light smoke consistent with authorized burning. Verify against burn permit database. NW wind dispersing smoke away from populated areas. Low concern.', 1),
      ('Payson Area, AZ', 34.2300, -111.3300, 'Dark gray', 'Heavy', 'W', 'Tonto NF Dispatch', 'Growing smoke column from Tonto NF. Fire behavior increasing with afternoon winds.', 'Confirmed', 'Heavy dark gray smoke with increasing fire behavior indicates transition to high-intensity fire. Afternoon wind increase will accelerate growth. Payson area should prepare for possible evacuation.', 1)
    `);

    // Seed community alerts (15 items)
    await client.query(`
      INSERT INTO community_alerts (title, alert_type, severity, affected_area, population_affected, message, status, ai_analysis, created_by) VALUES
      ('Evacuation Order - Riverside Fire', 'Evacuation Order', 'Critical', 'Riverside County Zones A-C', 15000, 'Mandatory evacuation for all residents in Zones A, B, and C.', 'Active', 'URGENT: All residents must evacuate immediately via designated routes. Take essential documents, medications, and pets. Evacuation centers open at Riverside Convention Center.', 1),
      ('Evacuation Warning - Blue Ridge', 'Evacuation Warning', 'High', 'Blue Ridge Communities', 8500, 'Be prepared to evacuate. Fire approaching from the east.', 'Active', 'Residents should pack essential items and be ready to leave at a moments notice. Monitor emergency radio frequency 1620 AM for updates. Have a plan for pets and livestock.', 1),
      ('Red Flag Warning Alert', 'Weather Alert', 'High', 'Southern California Mountains', 250000, 'Extreme fire weather conditions expected for next 72 hours.', 'Active', 'Critical fire weather with Santa Ana winds up to 60mph and humidity below 10%. No outdoor burning. Ensure defensible space. Have go-bags ready.', 1),
      ('Air Quality Advisory', 'Health Advisory', 'Medium', 'Sacramento Valley', 500000, 'Smoke from nearby fires creating unhealthy air quality.', 'Active', 'AQI exceeds 200 (Very Unhealthy). Limit outdoor activities. Close windows and use air filtration. N95 masks recommended outdoors. Check on elderly neighbors.', 1),
      ('Road Closure Notice', 'Infrastructure', 'Medium', 'Highway 18, Mile Marker 12-45', 45000, 'Highway 18 closed due to active fire operations.', 'Active', 'Highway 18 closed between MM 12 and MM 45 for firefighting operations. Detour via Highway 247 to I-15. Expect 45-minute delays. Re-opening TBD.', 1),
      ('Shelter-in-Place Order', 'Shelter Order', 'High', 'Pine Valley Community', 3200, 'Remain indoors. Do not attempt to evacuate at this time.', 'Active', 'Fire has crossed evacuation route. Shelter in place until routes are cleared. Close all windows and doors. Fill bathtubs with water. Stay away from exterior walls.', 1),
      ('Evacuation Lifted - Cedar Fire', 'All Clear', 'Low', 'Cedar Heights Subdivision', 4500, 'Evacuation order lifted. Residents may return home.', 'Resolved', 'Fire fully contained. Residents may return via Cedar Heights Road only. Power restored to 80% of area. Boil water advisory in effect. Report damage to county hotline.', 1),
      ('Power Shutoff Notice', 'Utility Alert', 'Medium', 'San Gabriel Mountains', 120000, 'Planned power shutoff due to extreme fire weather.', 'Active', 'Utility company implementing Public Safety Power Shutoff. Expected duration: 48-72 hours. Charge devices now. Generator safety: never use indoors.', 1),
      ('Prescribed Burn Notice', 'Informational', 'Low', 'Coconino National Forest', 25000, 'Prescribed burn planned for ecosystem health.', 'Active', 'US Forest Service conducting prescribed burn of 500 acres. Smoke visible from Highway 89A. No threat to communities. Air quality may be temporarily affected.', 1),
      ('Animal Evacuation Alert', 'Animal Services', 'High', 'Malibu Canyon Area', 8000, 'Large animal evacuation assistance available.', 'Active', 'LA County Animal Control providing large animal evacuation support. Trailer assistance at Zuma Beach parking lot. Small animal shelter at Agoura Hills Community Center.', 1),
      ('Water Supply Warning', 'Utility Alert', 'High', 'Mountain Communities', 15000, 'Water pressure reduced due to firefighting operations.', 'Active', 'Municipal water system experiencing reduced pressure due to fire hydrant use. Conserve water. Do not water landscapes. Bottled water distribution at Fire Station 9.', 1),
      ('School Closure Notice', 'Education', 'Medium', 'Unified School District #4', 35000, 'All schools closed due to fire and air quality.', 'Active', 'All District 4 schools closed until further notice due to nearby fire activity and poor air quality. Online learning resources available. School meals available for pickup.', 1),
      ('Volunteer Call-Out', 'Community', 'Medium', 'Tri-County Area', 200000, 'Volunteers needed for evacuation support.', 'Active', 'Red Cross seeking volunteers for evacuation shelters. Training provided. Register at RedCross.org or call 555-0123. Also need bilingual volunteers for translation services.', 1),
      ('Debris Flow Warning', 'Post-Fire', 'High', 'Thomas Fire Burn Scar', 45000, 'Rain forecast over burn area. Debris flow risk extreme.', 'Active', 'NWS issued debris flow warning for Thomas Fire burn scar. 1-inch rain expected. Evacuate low-lying areas near burn scar. Do not drive through flooded roadways.', 1),
      ('Fire Containment Update', 'Status Update', 'Medium', 'Regional Area', 100000, 'Major fire now 65% contained. Full containment expected in 48 hours.', 'Active', 'Significant progress on containment. Reduced acreage growth. Some evacuation zones being reassessed. Fire crews making excellent progress on northern perimeter.', 1)
    `);

    // Seed damage assessments (15 items)
    await client.query(`
      INSERT INTO damage_assessments (incident_name, location, acres_burned, structures_damaged, structures_destroyed, estimated_cost, injuries, fatalities, status, ai_analysis, created_by) VALUES
      ('Camp Fire', 'Paradise, CA', 153336.0, 280, 18804, 16500000000.00, 52, 85, 'Completed', 'Catastrophic loss. Most destructive fire in California history. Town of Paradise largely destroyed. Long-term recovery plan needed. FEMA major disaster declaration issued.', 1),
      ('Tubbs Fire', 'Santa Rosa, CA', 36807.0, 174, 5636, 1200000000.00, 23, 22, 'Completed', 'Devastating urban fire damage in Coffey Park and Fountaingrove neighborhoods. Rebuild program underway. Code updates implemented for fire-resistant construction.', 1),
      ('Thomas Fire', 'Ventura/SB Counties, CA', 281893.0, 86, 1063, 2200000000.00, 8, 2, 'Completed', 'Massive wildland fire with significant structure loss. Subsequent debris flows caused additional casualties. Watershed rehabilitation critical for post-fire hazard reduction.', 1),
      ('Carr Fire', 'Redding, CA', 229651.0, 277, 1614, 1500000000.00, 12, 8, 'Completed', 'Fire tornado documented. Extreme fire behavior destroyed portions of Redding. Infrastructure damage to water treatment and power systems significant.', 1),
      ('Woolsey Fire', 'Malibu, CA', 96949.0, 364, 1643, 6000000000.00, 3, 3, 'Completed', 'High-value property losses in Malibu. Santa Susana Field Lab contamination concerns. Coastal community rebuilding with enhanced fire codes.', 1),
      ('Mendocino Complex', 'Lake/Mendocino Co, CA', 459123.0, 43, 280, 500000000.00, 4, 1, 'Completed', 'Largest fire complex in California history. Relatively low structure count despite massive acreage. Primarily wildland area. Watershed damage extensive.', 1),
      ('Caldor Fire', 'El Dorado County, CA', 221835.0, 76, 1003, 800000000.00, 5, 0, 'Completed', 'Fire crossed Sierra crest—extremely rare event. South Lake Tahoe evacuated. Grizzly Flats community destroyed. Tourism economy severely impacted.', 1),
      ('Dixie Fire', 'Butte/Plumas Co, CA', 963309.0, 56, 1329, 1150000000.00, 3, 1, 'Completed', 'Largest single fire in California history. Destroyed town of Greenville. Burned across Sierra crest. Multi-year watershed rehabilitation required.', 1),
      ('Marshall Fire', 'Boulder County, CO', 6026.0, 371, 1084, 2000000000.00, 6, 2, 'Completed', 'Suburban fire driven by extreme winds. 30,000 evacuated. Most destructive fire in Colorado history. Wind-driven grass fire entered built environment.', 1),
      ('Hermits Peak/Calf Canyon', 'San Miguel Co, NM', 341471.0, 200, 903, 4600000000.00, 1, 0, 'Completed', 'Originated from prescribed fire escape. Federal liability acknowledged. Significant cultural and agricultural losses to Hispanic land grant communities.', 1),
      ('Maui Wildfires', 'Lahaina, Maui, HI', 2170.0, 500, 2207, 5500000000.00, 100, 101, 'In Progress', 'Deadliest US wildfire in over a century. Historic Lahaina town largely destroyed. Unprecedented urban conflagration driven by hurricane winds. Federal disaster aid ongoing.', 1),
      ('Oak Fire', 'Mariposa County, CA', 19244.0, 31, 127, 250000000.00, 0, 0, 'Completed', 'Fast-moving fire near Yosemite. Explosive growth in first 24 hours. Enhanced building codes proving effective in some areas. Tourism disruption significant.', 1),
      ('McKinney Fire', 'Siskiyou County, CA', 60138.0, 12, 185, 180000000.00, 2, 4, 'Completed', 'Rapid growth driven by dry thunderstorm outflow. Klamath River communities impacted. Bridge and road infrastructure damaged. Remote area complicates recovery.', 1),
      ('Mosquito Fire', 'Placer/El Dorado Co, CA', 76788.0, 28, 78, 120000000.00, 0, 0, 'Completed', 'Steep canyon fire with limited structure loss due to defensible space and fire-resistant construction. Success story for community preparedness programs.', 1),
      ('East Troublesome Fire', 'Grand County, CO', 193812.0, 67, 366, 500000000.00, 2, 2, 'Completed', 'Record-breaking fire crossed Continental Divide. Grand Lake area heavily impacted. Extreme fire behavior with 100,000+ acre day. Resort economy devastated.', 1)
    `);

    // Seed spread predictions (15 items)
    await client.query(`
      INSERT INTO spread_predictions (fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, status, ai_analysis, created_by) VALUES
      ('Riverside Fire', 2500.0, 35.0, 'NE', 'Steep canyon', 'Dense', 12.0, 98.0, 'Active', 'Extreme spread potential. Wind-driven fire in steep canyon with dense fuel. Expect 500+ acres/hour rate of spread. Spot fires up to 1 mile ahead. Crown fire likely.', 1),
      ('Blue Ridge Fire', 800.0, 20.0, 'W', 'Rolling hills', 'Moderate', 25.0, 88.0, 'Active', 'Moderate spread rate of 200 acres/hour. Wind-terrain alignment on west-facing slopes. Spread will slow at ridge tops. Night humidity recovery expected.', 1),
      ('Granite Peak Fire', 4200.0, 15.0, 'SW', 'Mountain slope', 'Dense', 18.0, 92.0, 'Active', 'Upslope runs during afternoon. Expect 300 acres/hour during peak burning period. Ridgetop spotting possible. Containment opportunity at Granite Creek.', 1),
      ('Cedar Creek Fire', 1200.0, 10.0, 'N', 'Valley floor', 'Light', 30.0, 85.0, 'Contained', 'Limited spread potential. Light fuels on valley floor with moderate humidity. Containment lines holding. Monitor for wind shift.', 1),
      ('Thompson Fire', 6800.0, 25.0, 'NW', 'Alpine/subalpine', 'Moderate', 15.0, 78.0, 'Active', 'Fire in subalpine zone spreading through mixed conifer. Terrain-driven runs up drainages. Expect increased activity with NW wind. Spot fire potential moderate.', 1),
      ('Sunrise Fire', 3500.0, 18.0, 'S', 'Mesa and canyon', 'Dense', 10.0, 102.0, 'Active', 'Critically dry conditions amplifying spread. Canyon wind funneling effect. 400 acres/hour in canyon bottoms. Mesa tops providing natural barriers.', 1),
      ('Eagle Fire', 950.0, 30.0, 'E', 'Mountain slopes', 'Dense', 8.0, 95.0, 'Active', 'Wind event driving extreme fire behavior. Downslope wind pushing fire toward communities. Rate of spread 600+ acres/hour possible. Immediate evacuations recommended.', 1),
      ('Desert Wind Fire', 5000.0, 22.0, 'NW', 'Desert flatland', 'Light', 7.0, 108.0, 'Active', 'Fast-moving grass/brush fire. Flash fuels enabling 800 acres/hour in grass. Slower in heavier desert scrub. Patchy fuels may create natural breaks.', 1),
      ('Cascade Fire', 2100.0, 12.0, 'E', 'Cascade slopes', 'Dense', 22.0, 87.0, 'Active', 'East wind pushing fire downslope into timber. Moderate spread rate. Inversions may trap fire overnight but expect breakout with afternoon mixing.', 1),
      ('Valley Fire', 15000.0, 8.0, 'Variable', 'Mixed terrain', 'Moderate', 28.0, 82.0, 'Monitoring', 'Large fire with reduced activity. Variable winds making prediction uncertain. Isolated runs possible in unburned pockets. Overall trend toward moderation.', 1),
      ('Summit Fire', 450.0, 15.0, 'W', 'Steep ravine', 'Dense', 20.0, 90.0, 'Active', 'Fire in steep ravine with chimney effect. Rapid upslope runs during daytime. Rate of spread 250 acres/hour on slope. Ridgetop arrival by evening.', 1),
      ('Wildcat Fire', 7200.0, 28.0, 'NE', 'Coastal mountains', 'Dense', 9.0, 96.0, 'Active', 'Santa Ana-driven fire with extreme spread potential. Dense chaparral fuels. 700+ acres/hour. Ember cast threatening communities 2+ miles ahead of fire front.', 1),
      ('Thunder Fire', 1800.0, 14.0, 'S', 'Pine plateau', 'Moderate', 24.0, 86.0, 'Active', 'Surface fire in pine with moderate spread. Ladder fuels could initiate torching. Rate of spread 150 acres/hour. Containment lines feasible on north side.', 1),
      ('Rim Fire', 8500.0, 16.0, 'W', 'Sierra foothills', 'Dense', 16.0, 94.0, 'Active', 'Timber fire with group torching. Spread rate 350 acres/hour in heavy timber. Drainage alignment increasing spread to SW. Spot fires establishing ahead.', 1),
      ('Pine Flat Fire', 180.0, 5.0, 'Variable', 'River bottom', 'Light', 35.0, 80.0, 'Contained', 'Minimal spread expected. Light winds and higher humidity limiting growth. Mop-up operations effective. Full containment within 24 hours projected.', 1)
    `);

    // Seed water sources (15 items)
    await client.query(`
      INSERT INTO water_sources (name, source_type, latitude, longitude, capacity_gallons, accessibility, road_access, helicopter_accessible, status, ai_analysis, created_by) VALUES
      ('Pine Lake Reservoir', 'Reservoir', 34.2500, -118.3000, 5000000, 'Year-round', 'Paved 2-lane', true, 'Available', 'Excellent tactical water source. Year-round availability with substantial capacity. Helicopter dip site suitable for Type 1 helicopters. 2-engine drafting capacity.', 1),
      ('Bear Creek Draft Site', 'Stream', 34.1800, -117.9500, 50000, 'Seasonal (May-Nov)', 'Gravel road', false, 'Available', 'Seasonal stream draft site. Adequate for single engine operations. Access road may be impassable in wet weather. Low flow late summer.', 1),
      ('Mountain Meadows Tank', 'Water Tank', 34.3200, -117.8000, 10000, 'Year-round', 'Paved access', false, 'Available', 'Fixed water tank with 10,000 gallon capacity. Quick fill capability for engines. Refill rate 500 GPM from municipal supply. 24/7 access.', 1),
      ('Eagle Rock Spring', 'Spring', 34.5000, -112.4000, 25000, 'Seasonal', 'Dirt road (4WD)', false, 'Available', 'Natural spring with collection pool. Limited capacity but reliable flow. 4WD access only—not suitable for large apparatus. Gravity feed possible downslope.', 1),
      ('Silverwood Lake', 'Lake', 34.2900, -117.3300, 75000000, 'Year-round', 'Highway access', true, 'Available', 'Major water source for aerial and ground operations. Multiple access points. Helicopter dip sites on east shore. VLAT scooper capable (if approved).', 1),
      ('Canyon Creek Hydrant #7', 'Hydrant', 34.2100, -118.1500, 1500, 'Year-round', 'Paved road', false, 'Available', 'Municipal hydrant with 1500 GPM flow rate. Adequate for 2 engines simultaneously. Located at intersection of Canyon Creek Rd and Forest Dr.', 1),
      ('Hidden Valley Pond', 'Pond', 34.4500, -112.5500, 200000, 'Seasonal', 'Gravel road', true, 'Available', 'Stock pond suitable for helicopter bucket fills. Minimum 18-inch depth maintained. Access road passable April-November. Secondary fill site.', 1),
      ('High Desert Cistern', 'Cistern', 34.8000, -117.5000, 5000, 'Year-round', 'Paved access', false, 'Available', 'Community cistern with solar-powered pump. 5000 gallon capacity with slow refill. Emergency water supply for remote area. Engine fill station.', 1),
      ('Cascade Falls Pool', 'Waterfall Pool', 46.8000, -121.5000, 100000, 'Seasonal (Jun-Oct)', 'Trail only (1.5mi)', true, 'Available', 'Natural pool below waterfall. Helicopter-only access for firefighting. Reliable flow June through October. Good for helibucket operations.', 1),
      ('Interstate Hydrant Station', 'Hydrant Station', 34.1500, -117.3000, 2500, 'Year-round', 'Interstate off-ramp', false, 'Available', 'High-flow hydrant station at highway rest area. 2500 GPM capacity. Excellent turnaround for water tenders. 24/7 access off I-15.', 1),
      ('Blue Lake Municipal', 'Lake', 40.8800, -123.9800, 10000000, 'Year-round', 'Highway 299', true, 'Available', 'Municipal lake with fire department drafting point. Multiple helicopter access. Shore stabilized for heavy apparatus. Excellent reliability.', 1),
      ('Rancho Bernardo Tank', 'Water Tank', 33.0200, -117.0800, 50000, 'Year-round', 'Paved access', false, 'Available', '50,000 gallon elevated tank. Gravity feed provides good pressure. Municipal supply with rapid refill. Engine fill point with 4-inch connection.', 1),
      ('Salmon River Draft', 'River', 41.3000, -123.3000, 500000, 'Year-round', 'Forest road', true, 'Available', 'Major river with year-round flow. Multiple draft sites along 10-mile stretch. Helicopter dip sites with good approach. Engine access at 3 points.', 1),
      ('Dry Creek Well', 'Well', 38.5000, -121.2000, 8000, 'Year-round', 'Gravel road', false, 'Maintenance', 'Deep well with electric pump. 8000 gallon storage tank. Pump needs repair—expected completion in 2 weeks. Generator backup available.', 1),
      ('Summit Ridge Tank', 'Portable Tank', 39.2000, -106.3000, 3000, 'Seasonal', '4WD trail', false, 'Deployed', 'Portable fold-a-tank deployed at ridgeline. 3000 gallon capacity. Helicopter-filled. Supports handline operations on remote summit.', 1)
    `);

    // Seed crew deployments (15 items)
    await client.query(`
      INSERT INTO crew_deployments (crew_name, crew_size, specialization, assigned_incident, deployment_location, shift_start, shift_end, fatigue_level, status, ai_analysis, created_by) VALUES
      ('Hotshots Team Alpha', 20, 'Hotshot Crew', 'Riverside Fire', 'Division Alpha - Southeast Flank', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '6 hours', 'Moderate', 'Deployed', 'Crew at moderate fatigue after 6 hours on steep terrain. Handline production on track. Recommend hydration break and crew rotation in 4 hours.', 1),
      ('Engine Company 44', 6, 'Structure Protection', 'Riverside Fire', 'Mountain View Estates', NOW() - INTERVAL '4 hours', NOW() + INTERVAL '8 hours', 'Low', 'Deployed', 'Fresh crew on structure protection detail. 6 structures prepped with hose lays. Good water supply from hydrants. Low fatigue—extend shift if needed.', 1),
      ('Helitack Crew 7', 9, 'Helicopter Operations', 'Blue Ridge Fire', 'Helibase - Regional Airport', NOW() - INTERVAL '8 hours', NOW() + INTERVAL '4 hours', 'High', 'Deployed', 'High fatigue after 8 hours of bucket operations. 23 water drops completed. Recommend crew swap at next rotation. Pilot approaching duty time limits.', 1),
      ('Hand Crew Bravo', 20, 'Hand Crew Type 2', 'Granite Peak Fire', 'Division Charlie - North Ridge', NOW() - INTERVAL '10 hours', NOW() + INTERVAL '2 hours', 'High', 'Deployed', 'Crew approaching end of shift with high fatigue. 2.5 miles of handline completed. Night crew briefed for relief. Ensure hot meal and rest period.', 1),
      ('Dozer Boss Unit 3', 3, 'Heavy Equipment', 'Cedar Creek Fire', 'Division Bravo - Containment Line', NOW() - INTERVAL '5 hours', NOW() + INTERVAL '7 hours', 'Low', 'Deployed', 'Dozer line progressing well. 1.8 miles completed. Fuel and maintenance check due in 3 hours. Moderate terrain allowing good progress.', 1),
      ('Smokejumper Team 6', 8, 'Initial Attack', 'Thompson Fire', 'Remote Ridge - Drop Zone 4', NOW() - INTERVAL '12 hours', NOW() + INTERVAL '0 hours', 'Critical', 'Returning', 'CRITICAL fatigue level. 12-hour shift in remote location complete. Helicopter extraction arranged. Mandatory 10-hour rest period required. Do not extend.', 1),
      ('Water Tender Crew 12', 4, 'Water Supply', 'Sunrise Fire', 'Division Delta - Water Point', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '9 hours', 'Low', 'Deployed', 'Water supply chain established. 3 tenders in rotation. 45-minute turnaround time. Adequate for current engine operations. Low crew fatigue.', 1),
      ('Incident Management Team 4', 35, 'Command Staff', 'Eagle Fire', 'Incident Command Post', NOW() - INTERVAL '14 hours', NOW() + INTERVAL '10 hours', 'Moderate', 'Deployed', 'IMT managing complex incident. Planning section preparing for operational period 3. Logistics section reports adequate resources. Finance tracking costs.', 1),
      ('Strike Team XR-5', 25, 'Engine Strike Team', 'Desert Wind Fire', 'Division Echo - Community Edge', NOW() - INTERVAL '7 hours', NOW() + INTERVAL '5 hours', 'Moderate', 'Deployed', '5 engines on structure protection. 45 homes in defense zone. Water supply adequate from hydrants. Recommend relief team staging for night shift.', 1),
      ('Rappel Crew 2', 7, 'Helicopter Rappel', 'Cascade Fire', 'Steep Drainage - Spot Fire', NOW() - INTERVAL '4 hours', NOW() + INTERVAL '8 hours', 'Low', 'Deployed', 'Rappel crew inserted to contain spot fire. Good progress on 2-acre spot. Steep terrain limiting tool use. Expected containment within shift.', 1),
      ('Fire Investigation Unit', 3, 'Investigation', 'Valley Fire', 'Point of Origin', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '6 hours', 'Low', 'Deployed', 'Investigation underway at point of origin. Evidence collection 60% complete. Scene secured with tape and signage. Witness interviews scheduled.', 1),
      ('Fuels Management Crew', 15, 'Prescribed Fire', 'Summit Fire', 'Division Fox - Burnout Ops', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '10 hours', 'Low', 'Deployed', 'Burnout operations beginning along containment line. Test fire conditions favorable. Crew experienced with firing operations. Holding crew in position.', 1),
      ('Medical Unit Team', 6, 'Emergency Medical', 'Wildcat Fire', 'Base Camp Medical', NOW() - INTERVAL '8 hours', NOW() + INTERVAL '4 hours', 'Moderate', 'Deployed', 'Medical unit treated 12 patients this shift. 3 heat exhaustion, 2 minor burns, 7 minor injuries. No serious casualties. ALS transport available.', 1),
      ('Communications Unit', 4, 'Radio/Comms', 'Thunder Fire', 'Comm Repeater - High Point', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '6 hours', 'Low', 'Deployed', 'Communications network established with 3 repeaters. All divisions reporting good radio coverage. Satellite phone backup operational. Cell service limited.', 1),
      ('Logistics Support Crew', 10, 'Base Camp Support', 'Rim Fire', 'Base Camp - Pine Mountain', NOW() - INTERVAL '10 hours', NOW() + INTERVAL '2 hours', 'Moderate', 'Deployed', 'Base camp operations supporting 1,200 personnel. Meal service on schedule. Shower units operational. Sleeping areas at 85% capacity. Supply chain adequate.', 1)
    `);

    // Seed equipment tracking (15 items)
    await client.query(`
      INSERT INTO equipment_tracking (equipment_name, equipment_type, serial_number, current_location, condition, last_maintenance, hours_used, assigned_to, status, ai_analysis, created_by) VALUES
      ('Engine 4471', 'Type 1 Engine', 'E-4471-2019', 'Riverside Fire - Div A', 'Good', '2024-08-15', 3420, 'Engine Company 44', 'Operational', 'Engine in good condition. Regular maintenance current. Oil change due at 3500 hours. Pump tested—within specifications. Hose inventory complete.', 1),
      ('Dozer D-220', 'Type 2 Dozer', 'D-220-2021', 'Cedar Creek Fire - Div B', 'Good', '2024-09-01', 1850, 'Dozer Boss Unit 3', 'Operational', 'Dozer operating within normal parameters. Tracks at 70% life. Hydraulic fluid levels good. Blade edges worn—replacement recommended after current assignment.', 1),
      ('Helicopter N782FD', 'Type 1 Helicopter', 'N782FD', 'Helibase - Regional Airport', 'Good', '2024-09-10', 4200, 'Helitack Crew 7', 'Operational', 'Helicopter passing daily inspection. Engine parameters normal. 200 hours until next phase inspection. Bambi bucket inspected—no damage. Night vision equipped.', 1),
      ('Water Tender WT-15', 'Tactical Water Tender', 'WT-15-2020', 'Sunrise Fire - Water Point', 'Fair', '2024-07-20', 2800, 'Water Tender Crew 12', 'Operational', 'Water tender showing age-related wear. Pump performance slightly reduced. Maintenance overdue by 200 hours. Schedule service after current deployment.', 1),
      ('Portable Pump PP-8', 'Mark 3 Pump', 'PP-008-2022', 'Blue Ridge Fire - Div C', 'Good', '2024-08-28', 450, 'Hotshots Team Alpha', 'Operational', 'Portable pump functioning well. Recent carburetor service. Fuel filter replaced. 200 feet of 1.5-inch hose in good condition. Reliable unit.', 1),
      ('Command Vehicle CV-01', 'Mobile Command Post', 'CV-01-2023', 'Eagle Fire ICP', 'Excellent', '2024-09-05', 890, 'IMT Team 4', 'Operational', 'Command vehicle in excellent condition. Communications suite fully operational. Generator running well. Mapping displays calibrated. AC system effective.', 1),
      ('Chainsaw CS-42', 'Professional Chainsaw', 'CS-42-2023', 'Granite Peak - Div C', 'Good', '2024-09-08', 280, 'Hand Crew Bravo', 'Operational', 'Chainsaw recently serviced. New chain installed. Bar in good condition. Safety features tested. Spare chain and bar in field kit.', 1),
      ('ATV-Utility UV-7', 'Utility ATV', 'UV-7-2022', 'Thompson Fire - Supply', 'Fair', '2024-06-15', 1200, 'Logistics Support', 'Maintenance', 'ATV experiencing intermittent electrical issues. Battery terminals corroded. Tire pressure low on rear left. Pull from service for maintenance before redeployment.', 1),
      ('Radio Repeater RR-3', 'Communications', 'RR-3-2021', 'Thunder Fire - High Point', 'Good', '2024-08-20', 5600, 'Communications Unit', 'Operational', 'Repeater operating on assigned frequency. Solar panel charging system functional. Battery backup holds 48-hour charge. Signal strength excellent from current position.', 1),
      ('Weather Station RAWS-7', 'Remote Weather Station', 'RAWS-7-2023', 'Wildcat Fire - Ridgetop', 'Good', '2024-09-01', 2100, 'Fire Weather Unit', 'Operational', 'RAWS collecting data every 10 minutes. Wind sensor calibrated. Temperature/humidity probe accurate. Data transmitting to WIMS. Solar power adequate.', 1),
      ('Air Tanker AT-44', 'VLAT (DC-10)', 'AT-44-2018', 'Tanker Base - Sacramento', 'Good', '2024-09-12', 8900, 'Cal Fire Aviation', 'Operational', 'VLAT passed pre-flight inspection. Retardant system tested. Drop pattern within specifications. Crew rest requirements met. Available for dispatch.', 1),
      ('Brush Truck BT-22', 'Type 3 Engine', 'BT-22-2020', 'Desert Wind Fire - Div E', 'Good', '2024-08-10', 2100, 'Strike Team XR-5', 'Operational', 'Brush truck well-suited for desert terrain. 4WD system functioning. Water tank full (500 gal). Foam system operational. Good off-road capability.', 1),
      ('Medical Unit MU-1', 'Ambulance/Medical', 'MU-1-2022', 'Wildcat Fire Base Camp', 'Good', '2024-09-02', 1500, 'Medical Unit Team', 'Operational', 'Medical unit fully stocked. ALS equipment inspected. Oxygen supply adequate. Medications within expiration dates. Defibrillator tested and charged.', 1),
      ('Mapping Drone DR-5', 'UAV/Drone', 'DR-5-2024', 'Rim Fire ICP', 'Excellent', '2024-09-14', 120, 'Planning Section', 'Operational', 'Mapping drone with IR capability. Battery fleet charged (6 batteries). 45-minute flight time per battery. GPS accuracy within 1 meter. Recent firmware update.', 1),
      ('Generator GEN-8', 'Portable Generator', 'GEN-8-2021', 'Cascade Fire - Camp', 'Fair', '2024-07-01', 3200, 'Logistics Support', 'Operational', 'Generator running but showing wear. Oil consumption increasing. Voltage output stable but monitor. Maintenance overdue—schedule after incident. Backup generator available.', 1)
    `);

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
