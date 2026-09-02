import fs from 'fs';
import path from 'path';

const carsPath = path.resolve('data/cars.json');
const carsData = JSON.parse(fs.readFileSync(carsPath, 'utf8'));

const carUpdates = {
  'hyundai-ioniq-5-2022': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Smooth Highway (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock / OP Long',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Balanced Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock / OP Long',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'toyota-rav4-2019': {
    drivingModel: 'WD40',
    configs: [
      {
        name: 'Highway Stability (WD40)',
        settings: {
          drivingModel: 'WD40',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      },
      {
        name: 'Comfort Touring (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Modern E2E (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'honda-civic-2022': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Daily Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock (EPS Mod)',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock Long',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Lateral Smoothness (TCPmV3)',
        settings: {
          drivingModel: 'The Cool Peoples Model v3',
          torqueTuning: 'Stock (EPS Mod)',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock Long',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'kia-niro-2023': {
    drivingModel: 'The Cool Peoples Model v3',
    configs: [
      {
        name: 'Community Choice (TCPmV3)',
        settings: {
          drivingModel: 'The Cool Peoples Model v3',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Fleet Favorite (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'genesis-gv60-2022': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Luxury Highway (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Fleet Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'ford-f150-2021': {
    drivingModel: 'Dark Souls Model v2',
    configs: [
      {
        name: 'Authoritative Control (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Highway Glider (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'chevy-bolt-2017': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Daily Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Centering Precision (CD210 Model)',
        settings: {
          drivingModel: 'CD210 Model',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      }
    ]
  },
  'chrysler-pacifica-2017': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Family Tour (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Balanced Highway (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'lincoln-navigator-2022': {
    drivingModel: 'Dark Souls Model v2',
    configs: [
      {
        name: 'Heavyweight Authority (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Luxury Highway (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'ram-1500-2019': {
    drivingModel: 'Dark Souls Model v2',
    configs: [
      {
        name: 'Truck Authority (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Highway Hauler (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'byd-frigate-07-2023': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Balanced Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'E2E Intelligent (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'honda-ridgeline-2022': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Balanced Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Firm Control (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'hyundai-tucson-hybrid-2022': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Smart Navigation (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock / OP Long',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Fleet Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock / OP Long',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'hyundai-elantra-2021': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Agile Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'E2E Urban (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'lexus-rc-2023': {
    drivingModel: 'OP Model 10 V3',
    configs: [
      {
        name: 'High Performance Lateral (OP Model 10 V3)',
        settings: {
          drivingModel: 'OP Model 10 V3',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Off-Policy Tested (Off-Policy Model v5)',
        settings: {
          drivingModel: 'Off-Policy Model v5',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'lexus-is-2017': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Proven Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Bleeding Edge (Firehose Model)',
        settings: {
          drivingModel: 'Firehose Model',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'lexus-rx350-2017': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Luxury Highway (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Centering Stiff (WD40)',
        settings: {
          drivingModel: 'WD40',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      }
    ]
  },
  'honda-accord-2018': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Proven Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Urban E2E (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'hyundai-ioniq-5-2026': {
    drivingModel: 'OP Model 10 V3',
    configs: [
      {
        name: 'Advanced E2E Lateral (OP Model 10 V3)',
        settings: {
          drivingModel: 'OP Model 10 V3',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Flagship World Model (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'kia-sportage-phev-2024': {
    drivingModel: 'Kumars Vibe',
    configs: [
      {
        name: 'Community Favorite (Kumars Vibe)',
        settings: {
          drivingModel: 'Kumars Vibe',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Firm Centering (Nevada Model)',
        settings: {
          drivingModel: 'Nevada Model',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'audi-a3-mqb-evo-2022': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Smooth Autobahn (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Modern Intelligent (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'subaru-crosstrek-2020': {
    drivingModel: 'CD210 Model',
    configs: [
      {
        name: 'Subaru Centering (CD210 Model)',
        settings: {
          drivingModel: 'CD210 Model',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Highway Stiff (WD40)',
        settings: {
          drivingModel: 'WD40',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      }
    ]
  },
  'honda-odyssey-2018': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Road Trip Comfort (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Daily Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'hyundai-sonata-2021': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Smart Navigation (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Agile Commute (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'toyota-sienna-2021': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Family Tour (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Solid Center (WD40)',
        settings: {
          drivingModel: 'WD40',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      }
    ]
  },
  'kia-ev6-2022': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Flagship Smart (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Balanced Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'kia-telluride-2020': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Passenger Favorite (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Maximum Stiffness (WD40)',
        settings: {
          drivingModel: 'WD40',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      }
    ]
  },
  'hyundai-palisade-2020': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Passenger Favorite (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Lateral Smooth (TCPmV3)',
        settings: {
          drivingModel: 'The Cool Peoples Model v3',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'kia-k5-2021': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Sporty Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'E2E World Model (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'hyundai-kona-ev-2019': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'City & Highway (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Commute Proven (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'toyota-tundra-2022': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Smooth Modern (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Large Truck Authority (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'mazda-cx5-2021': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Refined Comfort (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Active Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'subaru-ascent-2019': {
    drivingModel: 'CD210 Model',
    configs: [
      {
        name: 'Subaru AWD Centering (CD210 Model)',
        settings: {
          drivingModel: 'CD210 Model',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Passenger Glider (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'honda-pilot-2019': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Family Highway (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Standard Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'rivian-r1t-2022': {
    drivingModel: 'OP Model 10 V3',
    configs: [
      {
        name: 'Off-Policy Precision (OP Model 10 V3)',
        settings: {
          drivingModel: 'OP Model 10 V3',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Heavyweight Authority (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'tesla-model3-2017': {
    drivingModel: 'Pop Model v2',
    configs: [
      {
        name: 'Smooth Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'E2E Intelligent (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'volvo-xc90-2016': {
    drivingModel: 'CD210 Model',
    configs: [
      {
        name: 'Smooth Stability (CD210 Model)',
        settings: {
          drivingModel: 'CD210 Model',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Road Trip Comfort (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'ford-f150-lightning-2022': {
    drivingModel: 'Dark Souls Model v2',
    configs: [
      {
        name: 'Heavy EV Authority (Dark Souls Model v2)',
        settings: {
          drivingModel: 'Dark Souls Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Smooth Cruise (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'toyota-corolla-2023': {
    drivingModel: 'WD40',
    configs: [
      {
        name: 'Rock Solid Highway (WD40)',
        settings: {
          drivingModel: 'WD40',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'OFF'
        }
      },
      {
        name: 'All-Around Commuter (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'lincoln-corsair-2020': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Luxury Smooth (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Dynamic Daily (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'hyundai-custin-2025': {
    drivingModel: 'WMI V12',
    configs: [
      {
        name: 'Modern E2E (WMI V12)',
        settings: {
          drivingModel: 'WMI V12',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Passenger Glider (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'v0.0',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  },
  'ford-escape-2020': {
    drivingModel: 'Down to Ride v6',
    configs: [
      {
        name: 'Balanced Touring (Down to Ride v6)',
        settings: {
          drivingModel: 'Down to Ride v6',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      },
      {
        name: 'Commuter Choice (Pop Model v2)',
        settings: {
          drivingModel: 'Pop Model v2',
          torqueTuning: 'Stock',
          lateralControl: 'NNLC (On)',
          longitudinalControl: 'Stock',
          mads: 'Remain Active',
          experimentalMode: 'Dynamic'
        }
      }
    ]
  }
};

let updatedCount = 0;
carsData.vehicles.forEach(vehicle => {
  const update = carUpdates[vehicle.id];
  if (update) {
    vehicle.bestSettings.drivingModel = update.drivingModel;
    if (update.configs) {
      vehicle.configs = update.configs;
    }
    updatedCount++;
  }
});

carsData.lastUpdated = '2026-09-02';
fs.writeFileSync(carsPath, JSON.stringify(carsData, null, 4), 'utf8');
console.log(`Updated ${updatedCount} vehicles in ${carsPath}`);
