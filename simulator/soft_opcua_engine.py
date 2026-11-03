#!/usr/bin/env python3
"""
FUXA Enterprise - 5 Soft OPC-UA Server Simulation Lab & Fault Injection Engine
Runs 5 independent industrial PLC OPC-UA servers with 20+ dynamic tags each.
Supports live start, stop, network drop injection, and alarm glitch simulation.
"""

import asyncio
import logging
import math
import random
import time
from asyncua import Server, ua

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [SOFT-OPC] %(message)s")
logger = logging.getLogger("SoftOPC")

SIMULATOR_CONFIGS = [
    {
        "id": "sim_1",
        "name": "Paintshop Oven Line 1 PLC",
        "model": "Siemens S7-1500 / OPC-UA Core",
        "port": 4850,
        "endpoint": "opc.tcp://0.0.0.0:4850",
        "client_endpoint": "opc.tcp://127.0.0.1:4850",
        "plant": 9,
        "division": 6,
        "line": 1,
        "description": "Continuous baking oven with burner gas pressure, zone temperatures, and exhaust blowers",
        "tags": [
            {"name": "Oven_Zone1_Temp", "type": "float", "unit": "°C", "base": 195.0, "amp": 12.0, "freq": 0.08},
            {"name": "Oven_Zone2_Temp", "type": "float", "unit": "°C", "base": 210.0, "amp": 15.0, "freq": 0.07},
            {"name": "Oven_Zone3_Temp", "type": "float", "unit": "°C", "base": 220.0, "amp": 14.0, "freq": 0.09},
            {"name": "Exhaust_Blower_Speed", "type": "float", "unit": "RPM", "base": 1450.0, "amp": 40.0, "freq": 0.15},
            {"name": "Burner_Gas_Pressure", "type": "float", "unit": "bar", "base": 2.45, "amp": 0.25, "freq": 0.2},
            {"name": "Combustion_Air_Flow", "type": "float", "unit": "m³/h", "base": 485.0, "amp": 30.0, "freq": 0.12},
            {"name": "Conveyor_Speed_M_Min", "type": "float", "unit": "m/min", "base": 3.5, "amp": 0.3, "freq": 0.05},
            {"name": "Exhaust_Stack_Temp", "type": "float", "unit": "°C", "base": 152.0, "amp": 10.0, "freq": 0.06},
            {"name": "Chamber_Static_Pressure", "type": "float", "unit": "Pa", "base": -12.5, "amp": 3.0, "freq": 0.25},
            {"name": "Burner_Flame_Status", "type": "bool", "unit": "ON/OFF", "val": True},
            {"name": "Oven_Main_Power_KW", "type": "float", "unit": "kW", "base": 98.0, "amp": 10.0, "freq": 0.1},
            {"name": "Conveyor_Motor_Current", "type": "float", "unit": "A", "base": 15.2, "amp": 2.5, "freq": 0.18},
            {"name": "Blower_Vibration_MM_S", "type": "float", "unit": "mm/s", "base": 1.8, "amp": 0.6, "freq": 0.3},
            {"name": "Oven_Ready_For_Load", "type": "bool", "unit": "Status", "val": True},
            {"name": "Oven_Emergency_Stop", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Oven_Door_Entrance_Open", "type": "bool", "unit": "Door", "val": False},
            {"name": "Oven_Door_Exit_Open", "type": "bool", "unit": "Door", "val": False},
            {"name": "Total_Bodies_Processed", "type": "counter", "unit": "Units", "val": 1284},
            {"name": "Current_Batch_ID", "type": "int", "unit": "ID", "val": 90214},
            {"name": "Oven_Cycle_Timer_Sec", "type": "sawtooth", "unit": "s", "max": 600},
            {"name": "Over_Temp_Alarm", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Low_Gas_Pressure_Alarm", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Burner_Modulation_Pct", "type": "float", "unit": "%", "base": 75.0, "amp": 8.0, "freq": 0.1},
            {"name": "Ambient_Air_Temp", "type": "float", "unit": "°C", "base": 28.5, "amp": 2.5, "freq": 0.03}
        ]
    },
    {
        "id": "sim_2",
        "name": "Utility Powerhouse Boiler PLC",
        "model": "Allen-Bradley ControlLogix 5580",
        "port": 4851,
        "endpoint": "opc.tcp://0.0.0.0:4851",
        "client_endpoint": "opc.tcp://127.0.0.1:4851",
        "plant": 9,
        "division": 5,
        "line": 1,
        "description": "Industrial steam boiler, feedwater pump controls, and compressed air distribution",
        "tags": [
            {"name": "Boiler_Steam_Pressure_Bar", "type": "float", "unit": "bar", "base": 9.2, "amp": 0.8, "freq": 0.1},
            {"name": "Boiler_Steam_Temp_C", "type": "float", "unit": "°C", "base": 180.5, "amp": 4.5, "freq": 0.08},
            {"name": "Feedwater_Tank_Level_Pct", "type": "float", "unit": "%", "base": 72.0, "amp": 10.0, "freq": 0.05},
            {"name": "Feedwater_Flow_Rate_M3H", "type": "float", "unit": "m³/h", "base": 14.8, "amp": 2.5, "freq": 0.15},
            {"name": "Feedwater_Pump_Status", "type": "bool", "unit": "ON/OFF", "val": True},
            {"name": "Feedwater_Pump_Current_A", "type": "float", "unit": "A", "base": 24.5, "amp": 3.0, "freq": 0.2},
            {"name": "Boiler_Drum_Level_MM", "type": "float", "unit": "mm", "base": 2.0, "amp": 12.0, "freq": 0.14},
            {"name": "Flue_Gas_Oxygen_Pct", "type": "float", "unit": "%", "base": 4.2, "amp": 0.8, "freq": 0.12},
            {"name": "Fuel_Gas_Flow_NM3H", "type": "float", "unit": "Nm³/h", "base": 98.0, "amp": 15.0, "freq": 0.1},
            {"name": "Chilled_Water_Supply_Temp", "type": "float", "unit": "°C", "base": 7.2, "amp": 0.6, "freq": 0.06},
            {"name": "Chilled_Water_Return_Temp", "type": "float", "unit": "°C", "base": 12.4, "amp": 0.8, "freq": 0.06},
            {"name": "Chiller_Compressor_Power_KW", "type": "float", "unit": "kW", "base": 165.0, "amp": 20.0, "freq": 0.1},
            {"name": "Air_Compressor_1_Pressure", "type": "float", "unit": "bar", "base": 7.15, "amp": 0.25, "freq": 0.2},
            {"name": "Air_Compressor_2_Pressure", "type": "float", "unit": "bar", "base": 7.20, "amp": 0.20, "freq": 0.18},
            {"name": "Compressed_Air_Dew_Point", "type": "float", "unit": "°C", "base": -40.5, "amp": 1.5, "freq": 0.05},
            {"name": "Cooling_Tower_Fan_Speed", "type": "float", "unit": "RPM", "base": 880.0, "amp": 50.0, "freq": 0.1},
            {"name": "Cooling_Water_Temp", "type": "float", "unit": "°C", "base": 29.8, "amp": 1.5, "freq": 0.04},
            {"name": "Boiler_Efficiency_Pct", "type": "float", "unit": "%", "base": 90.5, "amp": 1.2, "freq": 0.03},
            {"name": "Boiler_Flame_Detector", "type": "bool", "unit": "Flame", "val": True},
            {"name": "Steam_Totalizer_Tons", "type": "counter", "unit": "Tons", "val": 5482},
            {"name": "High_Steam_Pressure_Alarm", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Low_Water_Cutoff_Alarm", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Utility_Master_Trip", "type": "bool", "unit": "Trip", "val": False}
        ]
    },
    {
        "id": "sim_3",
        "name": "EMS Smart Power & Energy Meter",
        "model": "Schneider Electric PM8000 Multi-function Meter",
        "port": 4852,
        "endpoint": "opc.tcp://0.0.0.0:4852",
        "client_endpoint": "opc.tcp://127.0.0.1:4852",
        "plant": 9,
        "division": 6,
        "line": 2,
        "description": "3-phase power quality, harmonic distortion, energy totalizer, and power factor telemetry",
        "tags": [
            {"name": "Grid_Voltage_V_L1_N", "type": "float", "unit": "V", "base": 230.5, "amp": 2.5, "freq": 0.1},
            {"name": "Grid_Voltage_V_L2_N", "type": "float", "unit": "V", "base": 231.0, "amp": 2.0, "freq": 0.1},
            {"name": "Grid_Voltage_V_L3_N", "type": "float", "unit": "V", "base": 229.8, "amp": 2.2, "freq": 0.1},
            {"name": "Grid_Frequency_Hz", "type": "float", "unit": "Hz", "base": 50.01, "amp": 0.04, "freq": 0.2},
            {"name": "Phase_Current_A_L1", "type": "float", "unit": "A", "base": 365.0, "amp": 35.0, "freq": 0.15},
            {"name": "Phase_Current_A_L2", "type": "float", "unit": "A", "base": 358.0, "amp": 30.0, "freq": 0.15},
            {"name": "Phase_Current_A_L3", "type": "float", "unit": "A", "base": 372.0, "amp": 38.0, "freq": 0.15},
            {"name": "Total_Active_Power_KW", "type": "float", "unit": "kW", "base": 252.0, "amp": 25.0, "freq": 0.12},
            {"name": "Total_Reactive_Power_KVAR", "type": "float", "unit": "kVAR", "base": 44.0, "amp": 6.0, "freq": 0.1},
            {"name": "Total_Apparent_Power_KVA", "type": "float", "unit": "kVA", "base": 256.0, "amp": 26.0, "freq": 0.12},
            {"name": "Overall_Power_Factor", "type": "float", "unit": "PF", "base": 0.965, "amp": 0.015, "freq": 0.08},
            {"name": "Total_Active_Energy_MWH", "type": "counter", "unit": "MWh", "val": 1428},
            {"name": "Daily_Energy_Consumption_KWH", "type": "counter", "unit": "kWh", "val": 4912},
            {"name": "Peak_Demand_KW", "type": "float", "unit": "kW", "base": 315.0, "amp": 0.0, "freq": 0.0},
            {"name": "Transformer_1_Oil_Temp", "type": "float", "unit": "°C", "base": 61.5, "amp": 3.5, "freq": 0.04},
            {"name": "Transformer_1_Winding_Temp", "type": "float", "unit": "°C", "base": 73.0, "amp": 5.0, "freq": 0.05},
            {"name": "Neutral_Current_A", "type": "float", "unit": "A", "base": 12.4, "amp": 3.0, "freq": 0.18},
            {"name": "THD_Voltage_Pct", "type": "float", "unit": "%", "base": 1.65, "amp": 0.35, "freq": 0.1},
            {"name": "THD_Current_Pct", "type": "float", "unit": "%", "base": 4.25, "amp": 0.75, "freq": 0.12},
            {"name": "Main_Breaker_Status", "type": "bool", "unit": "Closed", "val": True},
            {"name": "Capacitor_Bank_1_Online", "type": "bool", "unit": "Bank", "val": True},
            {"name": "Capacitor_Bank_2_Online", "type": "bool", "unit": "Bank", "val": True},
            {"name": "Voltage_Sag_Detected", "type": "bool", "unit": "Sag", "val": False},
            {"name": "Overcurrent_Warning", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Energy_Cost_Today_INR", "type": "counter", "unit": "₹", "val": 39296}
        ]
    },
    {
        "id": "sim_4",
        "name": "Stamping Heavy Press Line PLC",
        "model": "Mitsubishi MELSEC iQ-R Series PLC",
        "port": 4853,
        "endpoint": "opc.tcp://0.0.0.0:4853",
        "client_endpoint": "opc.tcp://127.0.0.1:4853",
        "plant": 2,
        "division": 2,
        "line": 1,
        "description": "5000kN hydraulic stamping press with die protection, cushion pressure, and stroke counter",
        "tags": [
            {"name": "Press_Strokes_Per_Min", "type": "float", "unit": "SPM", "base": 18.0, "amp": 2.5, "freq": 0.1},
            {"name": "Main_Motor_Speed_RPM", "type": "float", "unit": "RPM", "base": 980.0, "amp": 60.0, "freq": 0.1},
            {"name": "Hydraulic_Cushion_Pressure", "type": "float", "unit": "bar", "base": 145.0, "amp": 15.0, "freq": 0.15},
            {"name": "Slide_Tonnage_KN", "type": "float", "unit": "kN", "base": 4450.0, "amp": 450.0, "freq": 0.2},
            {"name": "Die_Protection_Sensor_1", "type": "bool", "unit": "Clear", "val": True},
            {"name": "Die_Protection_Sensor_2", "type": "bool", "unit": "Clear", "val": True},
            {"name": "Clutch_Brake_Air_Pressure", "type": "float", "unit": "bar", "base": 5.85, "amp": 0.3, "freq": 0.18},
            {"name": "Flywheel_Lubrication_Pressure", "type": "float", "unit": "bar", "base": 3.65, "amp": 0.3, "freq": 0.12},
            {"name": "Lube_Oil_Temp_C", "type": "float", "unit": "°C", "base": 48.0, "amp": 4.0, "freq": 0.05},
            {"name": "Parts_Produced_Counter", "type": "counter", "unit": "Parts", "val": 8642},
            {"name": "Scrap_Parts_Counter", "type": "counter", "unit": "Parts", "val": 19},
            {"name": "Press_Cycle_Time_Sec", "type": "float", "unit": "s", "base": 3.1, "amp": 0.25, "freq": 0.1},
            {"name": "Sheet_Feeder_Position_MM", "type": "sawtooth", "unit": "mm", "max": 650},
            {"name": "Blank_Thickness_MM", "type": "float", "unit": "mm", "base": 1.20, "amp": 0.015, "freq": 0.1},
            {"name": "Safety_Light_Curtain_Clear", "type": "bool", "unit": "Safety", "val": True},
            {"name": "Press_Motor_Current_A", "type": "float", "unit": "A", "base": 56.0, "amp": 10.0, "freq": 0.16},
            {"name": "Upper_Die_Clamped", "type": "bool", "unit": "Clamp", "val": True},
            {"name": "Lower_Die_Clamped", "type": "bool", "unit": "Clamp", "val": True},
            {"name": "Die_Change_Mode_Active", "type": "bool", "unit": "Mode", "val": False},
            {"name": "Tonnage_Overload_Alarm", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "Emergency_Stop_Pushed", "type": "bool", "unit": "E-Stop", "val": False},
            {"name": "Press_Running_Status", "type": "bool", "unit": "Running", "val": True}
        ]
    },
    {
        "id": "sim_5",
        "name": "TopCoat Robotic Spray Painting Cell",
        "model": "ABB IRB 5500 Paint Robot Controller",
        "port": 4854,
        "endpoint": "opc.tcp://0.0.0.0:4854",
        "client_endpoint": "opc.tcp://127.0.0.1:4854",
        "plant": 9,
        "division": 6,
        "line": 3,
        "description": "High-voltage electrostatic bell atomizer, 6-axis joint telemetry, fluid delivery, and booth air balance",
        "tags": [
            {"name": "Robot_1_Joint1_Angle_Deg", "type": "float", "unit": "°", "base": 0.0, "amp": 35.0, "freq": 0.1},
            {"name": "Robot_1_Joint2_Angle_Deg", "type": "float", "unit": "°", "base": 15.0, "amp": 25.0, "freq": 0.08},
            {"name": "Robot_1_Joint3_Angle_Deg", "type": "float", "unit": "°", "base": 45.0, "amp": 30.0, "freq": 0.12},
            {"name": "Paint_Flow_Rate_CC_Min", "type": "float", "unit": "cc/min", "base": 315.0, "amp": 45.0, "freq": 0.2},
            {"name": "Atomizing_Air_Pressure_Bar", "type": "float", "unit": "bar", "base": 4.15, "amp": 0.25, "freq": 0.14},
            {"name": "Shaping_Air_Pressure_Bar", "type": "float", "unit": "bar", "base": 2.50, "amp": 0.3, "freq": 0.15},
            {"name": "Bell_Cup_Speed_RPM", "type": "float", "unit": "RPM", "base": 41500.0, "amp": 2500.0, "freq": 0.1},
            {"name": "High_Voltage_KV", "type": "float", "unit": "kV", "base": 75.0, "amp": 5.0, "freq": 0.08},
            {"name": "Electrostatic_Current_UA", "type": "float", "unit": "µA", "base": 58.0, "amp": 12.0, "freq": 0.18},
            {"name": "Paint_Color_Code", "type": "int", "unit": "RAL", "val": 401},
            {"name": "Paint_Viscosity_Sec", "type": "float", "unit": "s", "base": 22.8, "amp": 1.2, "freq": 0.04},
            {"name": "Paint_Resistivity_MOHM", "type": "float", "unit": "MΩ", "base": 32.0, "amp": 4.0, "freq": 0.05},
            {"name": "Paint_Temperature_C", "type": "float", "unit": "°C", "base": 23.2, "amp": 0.6, "freq": 0.03},
            {"name": "Solvent_Flush_Valve_Closed", "type": "bool", "unit": "Valve", "val": True},
            {"name": "Booth_Air_Velocity_M_S", "type": "float", "unit": "m/s", "base": 0.40, "amp": 0.04, "freq": 0.1},
            {"name": "Booth_Relative_Humidity_Pct", "type": "float", "unit": "%", "base": 65.0, "amp": 2.5, "freq": 0.04},
            {"name": "Booth_Temperature_C", "type": "float", "unit": "°C", "base": 23.5, "amp": 1.0, "freq": 0.03},
            {"name": "Car_Body_Detected", "type": "bool", "unit": "Sensor", "val": True},
            {"name": "Robot_Cycle_Time_Sec", "type": "sawtooth", "unit": "s", "max": 60},
            {"name": "Bodies_Painted_Total", "type": "counter", "unit": "Bodies", "val": 714},
            {"name": "Bell_Cup_Clean_Required", "type": "bool", "unit": "Maint", "val": False},
            {"name": "Paint_Pressure_Fault", "type": "bool", "unit": "Alarm", "val": False},
            {"name": "HV_Short_Circuit_Trip", "type": "bool", "unit": "Trip", "val": False},
            {"name": "Robot_EStop_Ok", "type": "bool", "unit": "E-Stop", "val": True},
            {"name": "Robot_Auto_Mode_Active", "type": "bool", "unit": "Auto", "val": True}
        ]
    }
]

class SoftOPCServerInstance:
    def __init__(self, cfg):
        self.cfg = cfg
        self.id = cfg["id"]
        self.name = cfg["name"]
        self.port = cfg["port"]
        self.endpoint = cfg["endpoint"]
        self.client_endpoint = cfg["client_endpoint"]
        self.server = None
        self.running = False
        self.node_vars = {}
        self.cached_values = {}
        self.uptime_start = None
        self.tick_count = 0
        self.glitch_active = False

    async def start(self):
        if self.running:
            return True
        try:
            self.server = Server()
            await self.server.init()
            self.server.set_endpoint(self.endpoint)
            self.server.set_server_name(f"{self.name} [FUXA Simulator]")
            self.server.set_security_policy([ua.SecurityPolicyType.NoSecurity])

            uri = f"http://fuxa.enterprise/sim/{self.id}"
            idx = await self.server.register_namespace(uri)

            # Build folders: Objects -> {DeviceName} -> Tags
            objects = self.server.nodes.objects
            dev_folder = await objects.add_folder(idx, self.name.replace(" ", "_"))

            self.node_vars = {}
            for t_def in self.cfg["tags"]:
                t_name = t_def["name"]
                t_type = t_def.get("type", "float")
                init_val = t_def.get("val", t_def.get("base", 0.0))

                if t_type == "bool":
                    var_node = await dev_folder.add_variable(idx, t_name, bool(init_val), ua.VariantType.Boolean)
                elif t_type in ("int", "counter", "sawtooth"):
                    var_node = await dev_folder.add_variable(idx, t_name, int(init_val), ua.VariantType.Int32)
                else:
                    var_node = await dev_folder.add_variable(idx, t_name, float(init_val), ua.VariantType.Double)

                await var_node.set_writable()
                self.node_vars[t_name] = var_node
                self.cached_values[t_name] = {
                    "name": t_name,
                    "value": init_val,
                    "unit": t_def.get("unit", ""),
                    "type": t_type,
                    "timestamp": time.time()
                }

            await self.server.start()
            self.running = True
            self.uptime_start = time.time()
            logger.info(f"Started Soft OPC-UA Server: {self.name} on {self.client_endpoint} ({len(self.node_vars)} tags)")
            return True
        except Exception as e:
            logger.error(f"Failed to start {self.name} on port {self.port}: {e}")
            self.running = False
            return False

    async def stop(self):
        if not self.running or not self.server:
            self.running = False
            return True
        try:
            await self.server.stop()
            logger.info(f"Stopped Soft OPC-UA Server: {self.name} (: {self.port})")
        except Exception as e:
            logger.warning(f"Error during shutdown of {self.name}: {e}")
        finally:
            self.server = None
            self.running = False
            self.uptime_start = None
        return True

    async def update_simulation_tick(self, t_now):
        if not self.running:
            return
        self.tick_count += 1
        t_sec = t_now

        for t_def in self.cfg["tags"]:
            t_name = t_def["name"]
            t_type = t_def.get("type", "float")
            var_node = self.node_vars.get(t_name)
            if not var_node:
                continue

            try:
                new_val = None
                if self.glitch_active and "Alarm" in t_def.get("unit", ""):
                    new_val = True
                elif self.glitch_active and t_type == "float" and "Temp" in t_name:
                    new_val = round(t_def.get("base", 100.0) * 1.85, 2)
                elif t_type == "float":
                    base = t_def.get("base", 50.0)
                    amp = t_def.get("amp", 5.0)
                    freq = t_def.get("freq", 0.1)
                    noise = (random.random() - 0.5) * (amp * 0.15)
                    new_val = round(base + amp * math.sin(t_sec * freq) + noise, 2)
                    var_val = ua.Variant(float(new_val), ua.VariantType.Double)
                elif t_type == "bool":
                    new_val = t_def.get("val", True)
                    if random.random() < 0.005 and "Alarm" not in t_def.get("unit", ""):
                        new_val = not new_val
                    var_val = ua.Variant(bool(new_val), ua.VariantType.Boolean)
                elif t_type == "counter":
                    cur = self.cached_values.get(t_name, {}).get("value", t_def.get("val", 0))
                    new_val = int(cur) + (1 if self.tick_count % 3 == 0 else 0)
                    var_val = ua.Variant(int(new_val), ua.VariantType.Int32)
                elif t_type == "sawtooth":
                    max_v = t_def.get("max", 60)
                    new_val = int(t_sec % max_v)
                    var_val = ua.Variant(int(new_val), ua.VariantType.Int32)
                else:
                    new_val = t_def.get("val", 0)
                    var_val = ua.Variant(int(new_val), ua.VariantType.Int32)

                await var_node.write_value(var_val)
                self.cached_values[t_name] = {
                    "name": t_name,
                    "value": new_val,
                    "unit": t_def.get("unit", ""),
                    "type": t_type,
                    "timestamp": t_now
                }
            except Exception:
                pass

    def inject_glitch(self, duration=6):
        self.glitch_active = True
        asyncio.create_task(self._clear_glitch_later(duration))

    async def _clear_glitch_later(self, duration):
        await asyncio.sleep(duration)
        self.glitch_active = False

    def get_summary(self):
        uptime = int(time.time() - self.uptime_start) if (self.running and self.uptime_start) else 0
        return {
            "id": self.id,
            "name": self.name,
            "model": self.cfg["model"],
            "port": self.port,
            "endpoint": self.client_endpoint,
            "running": self.running,
            "uptime_seconds": uptime,
            "plant": self.cfg["plant"],
            "division": self.cfg["division"],
            "line": self.cfg["line"],
            "description": self.cfg["description"],
            "tag_count": len(self.cfg["tags"]),
            "glitch_active": self.glitch_active
        }

class SoftOPCManager:
    def __init__(self):
        self.servers = {cfg["id"]: SoftOPCServerInstance(cfg) for cfg in SIMULATOR_CONFIGS}
        self.loop_task = None
        self.is_running = False

    async def start_all(self):
        logger.info("Initializing 5 Soft OPC-UA Industrial Simulators...")
        results = []
        for s in self.servers.values():
            res = await s.start()
            results.append(res)
        
        self.is_running = True
        if not self.loop_task or self.loop_task.done():
            self.loop_task = asyncio.create_task(self._simulation_loop())
        return all(results)

    async def stop_all(self):
        logger.info("Stopping all Soft OPC-UA Simulators...")
        for s in self.servers.values():
            await s.stop()
        self.is_running = False

    async def start_server(self, server_id):
        s = self.servers.get(server_id)
        if s:
            return await s.start()
        return False

    async def stop_server(self, server_id):
        s = self.servers.get(server_id)
        if s:
            return await s.stop()
        return False

    async def drop_network(self, server_id, duration=5):
        s = self.servers.get(server_id)
        if not s or not s.running:
            return False
        logger.warning(f"[FAULT-INJECTION] Dropping network socket for {s.name} (: {s.port}) for {duration} seconds...")
        await s.stop()
        async def _reconnect_after():
            await asyncio.sleep(duration)
            logger.info(f"[FAULT-INJECTION] Restoring network socket for {s.name} (: {s.port})...")
            await s.start()
        asyncio.create_task(_reconnect_after())
        return True

    def glitch_server(self, server_id, duration=6):
        s = self.servers.get(server_id)
        if s and s.running:
            s.inject_glitch(duration)
            return True
        return False

    def get_status(self):
        total_tags = sum(len(c["tags"]) for c in SIMULATOR_CONFIGS)
        running_count = sum(1 for s in self.servers.values() if s.running)
        return {
            "is_lab_active": self.is_running,
            "running_servers": running_count,
            "total_servers": len(self.servers),
            "total_tags": total_tags,
            "servers": [s.get_summary() for s in self.servers.values()]
        }

    def get_live_tags(self, server_id):
        s = self.servers.get(server_id)
        if not s:
            return {}
        return s.cached_values

    async def _simulation_loop(self):
        while self.is_running:
            t_now = time.time()
            tasks = [s.update_simulation_tick(t_now) for s in self.servers.values() if s.running]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(1.0)

# Global singleton
soft_opc_manager = SoftOPCManager()

if __name__ == "__main__":
    async def main():
        await soft_opc_manager.start_all()
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            await soft_opc_manager.stop_all()

    asyncio.run(main())
