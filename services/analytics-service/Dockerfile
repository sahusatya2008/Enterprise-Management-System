FROM python:3.12-slim

WORKDIR /app

COPY services/analytics-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY services/analytics-service/app ./app

EXPOSE 5001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5001"]

