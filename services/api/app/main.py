import csv
from io import StringIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .analysis import analyse_csv_content


app = FastAPI(
    title="Brasaland Incidents API",
    description="API for analyzing Brasaland incident CSV files.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


latest_results = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "brasaland-incidents-api",
    }


@app.post("/api/incidents/analyze")
async def analyze_incidents(file: UploadFile = File(...)):
    global latest_results

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="A CSV file is required.",
        )

    try:
        content = await file.read()
        csv_content = content.decode("utf-8")

        results = analyse_csv_content(csv_content)

        latest_results = results

        return results

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="The CSV file must use UTF-8 encoding.",
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@app.get("/api/incidents/results/export")
def export_results():
    if latest_results is None:
        raise HTTPException(
            status_code=404,
            detail="No analysis results available. Analyze a CSV first.",
        )

    results = latest_results

    valid_total = results["valid"]

    rows = [
        {
            "metric": "total_records",
            "value": results["total"],
            "percentage": "",
        },
        {
            "metric": "valid_records",
            "value": results["valid"],
            "percentage": (
                results["valid"] / results["total"] * 100
                if results["total"]
                else 0
            ),
        },
        {
            "metric": "invalid_records",
            "value": results["invalid"],
            "percentage": (
                results["invalid"] / results["total"] * 100
                if results["total"]
                else 0
            ),
        },
    ]

    for category, count in results["categories"].items():
        rows.append(
            {
                "metric": f"category_{category}",
                "value": count,
                "percentage": (
                    count / valid_total * 100
                    if valid_total
                    else 0
                ),
            }
        )

    for status, count in results["statuses"].items():
        rows.append(
            {
                "metric": f"status_{status}",
                "value": count,
                "percentage": (
                    count / valid_total * 100
                    if valid_total
                    else 0
                ),
            }
        )

    rows.append(
        {
            "metric": "satisfaction_average",
            "value": f"{results['satisfaction_average']:.2f}",
            "percentage": "",
        }
    )

    output = StringIO()

    writer = csv.DictWriter(
        output,
        fieldnames=["metric", "value", "percentage"],
    )

    writer.writeheader()
    writer.writerows(rows)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                "attachment; filename=incidents-results.csv"
            )
        },
    )
