import json

file_path = "data/cars.json"
with open(file_path, "r") as f:
    data = json.load(f)

recommended_ids = {
    "hyundai-ioniq-5-2022",
    "honda-civic-2022",
    "kia-niro-2023",
    "genesis-gv60-2022",
    "lexus-is-2017",
    "chevy-bolt-2017",
    "toyota-sienna-2021",
    "ford-f150-2021"
}

for vehicle in data.get("vehicles", []):
    if vehicle["id"] in recommended_ids:
        vehicle["isRecommended"] = True
    else:
        # Avoid leaving it undefined if preferred, but undefined is fine too as it's optional.
        pass

with open(file_path, "w") as f:
    json.dump(data, f, indent=4)

print("Updated cars.json")
