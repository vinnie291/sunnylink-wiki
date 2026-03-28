import json
import os

file_path = '/Users/vinhle/Documents/dev/sunnylink-wiki/data/cars.json'

with open(file_path, 'r') as f:
    data = json.load(f)

for v in data['vehicles']:
    if v['id'] == 'lexus-is-2017':
        v['reviews'] = [
            {
                "user": "Adrian_Abedon",
                "rating": 5,
                "comment": "Firehose model transformed my IS. Lane centering is now rock solid on the freeway."
            },
            {
                "user": "Lexus_Driver_99",
                "rating": 4.5,
                "comment": "Torque v0.0 is much better than the default. Highly recommend the setup."
            }
        ]
    if v['id'] == 'lexus-rx350-2017':
        v['reviews'] = [
            {
                "user": "peterclampton",
                "rating": 4.8,
                "comment": "Adding positive camera offset fixed my left-hugging issues. Firehose is great."
            }
        ]

with open(file_path, 'w') as f:
    json.dump(data, f, indent=4)
