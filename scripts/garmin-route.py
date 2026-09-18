import json
import sys
from garmin_mcp import init_api

activity_id = sys.argv[1]
client = init_api(None, None)
details = client.get_activity_details(activity_id, maxpoly=500)
keys = [descriptor.get("key") for descriptor in details.get("metricDescriptors", [])]
latitude_index = keys.index("directLatitude") if "directLatitude" in keys else None
longitude_index = keys.index("directLongitude") if "directLongitude" in keys else None
points = []
if latitude_index is not None and longitude_index is not None:
    for entry in details.get("activityDetailMetrics", []):
        metrics = entry.get("metrics", [])
        if len(metrics) > max(latitude_index, longitude_index):
            latitude, longitude = metrics[latitude_index], metrics[longitude_index]
            if latitude is not None and longitude is not None:
                points.append({"latitude": latitude, "longitude": longitude})
print(json.dumps({"activityId": activity_id, "points": points}))
