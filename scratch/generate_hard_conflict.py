import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import white, black
from PIL import Image, ImageDraw, ImageFont

def generate_conflict_pdf(output_filename):
    # 1. Create an image with the visual CGPA
    # This will be seen by the Vision model (Vertex VLM)
    img_width, img_height = 400, 100
    img = Image.new('RGB', (img_width, img_height), color='white')
    d = ImageDraw.Draw(img)
    # Using default font, but scaled up
    d.text((10, 10), "Name: Agentic Conflict", fill=(0,0,0))
    d.text((10, 40), "Institution: Paradox University", fill=(0,0,0))
    d.text((10, 70), "CGPA: 4.0", fill=(0,0,0))
    img.save("scratch/conflict_visual.png")

    # 2. Create the PDF
    c = canvas.Canvas(output_filename, pagesize=letter)
    
    # 3. Draw invisible text for the Text model (OpenAI) via pdfjs-dist
    # It will extract this text perfectly, but the VLM will barely notice it because it's white-on-white or hidden
    c.setFillColor(white)
    c.drawString(100, 700, "Degree Certificate")
    c.drawString(100, 680, "Name: Agentic Conflict")
    c.drawString(100, 660, "Institution: Paradox University")
    c.drawString(100, 640, "CGPA: 2.0")  # The hidden trap!
    
    # 4. Draw the image for the Vision model
    c.drawImage("scratch/conflict_visual.png", 100, 500, width=400, height=100)
    
    # Add a visible title so it doesn't look completely blank to humans
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 750, "Degree Certificate")
    
    c.save()
    print(f"Generated {output_filename}")

if __name__ == "__main__":
    generate_conflict_pdf("scratch/hard_conflict.pdf")
