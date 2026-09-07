# Use an official Python 3.10 slim image
FROM python:3.10-slim

# Install system dependencies required by OpenCV and PyTorch
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*


# Set up working directory
WORKDIR /code

# Copy and install python dependencies
COPY requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Create a non-root user (UID 1000 is required by Hugging Face Spaces)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set working directory inside user's home
WORKDIR $HOME/app

# Copy the server and the verified YOLO weights into the container. Build this
# image with the repository root as context, or place final_best.pt beside this
# Dockerfile before building a standalone Space export.
COPY --chown=user:user ai_inference_server.py .
COPY --chown=user:user final_best.pt .

# Create the static folder for annotated video storage
RUN mkdir -p static

# Expose port 7860 (Hugging Face's default port)
EXPOSE 7860

# Set environment variable to make FastAPI start on Hugging Face's port
ENV AI_SERVER_PORT=7860

# Run the FastAPI server
CMD ["python", "ai_inference_server.py"]
