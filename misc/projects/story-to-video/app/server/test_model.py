from google import genai

# Initialize the client (make sure you set the API key in environment)
client = genai.Client(api_key="AIzaSyCUr4tZAA2WmqtHv3hnpl8a0nrlchnAz9s")

# List available models
models = client.list_models()

# Print details
for model in models:
    print(f"Model name: {model.name}")
    print(f"  Description: {model.description}")
    print(f"  Supported capabilities: {model.capabilities}")
    print(f"  Parameters: {model.parameters}")
    print()
