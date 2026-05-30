from fpdf import FPDF
import os

# 1. Fake/Forged Document
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="UNIVERSITY OF PRESTIGE", ln=1, align='C')
pdf.cell(200, 10, txt="Official Marksheet", ln=1, align='C')
pdf.text(20, 50, "Student Name: Alice Faker")
pdf.text(20, 60, "Date of Birth: 01/01/2000")
pdf.text(20, 70, "Degree: Bachelor of AI")
pdf.text(20, 80, "CGPA: 4.0")
pdf.set_font("Arial", 'I', 6)
pdf.text(20, 280, "Warning: This document contains traces of digital manipulation and AI generation artifacts.")
pdf.text(20, 285, "The cryptographic seal is missing. Hologram validation failed.")
pdf.output("test_forgery.pdf")

# 2. Consensus Match Document
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="STANDARD INSTITUTE OF TECHNOLOGY", ln=1, align='C')
pdf.cell(200, 10, txt="Degree Certificate", ln=1, align='C')
pdf.text(20, 50, "Holder Name: Bob Standard")
pdf.text(20, 60, "Date of Birth: 15/08/1998")
pdf.text(20, 70, "Degree: Master of Computer Science")
pdf.text(20, 80, "CGPA: 3.8")
pdf.text(20, 90, "Year: 2022")
pdf.output("test_consensus.pdf")

# 3. Conflict / Self-Correction Document
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)
pdf.cell(200, 10, txt="AMBIGUOUS UNIVERSITY", ln=1, align='C')
pdf.cell(200, 10, txt="Transcript", ln=1, align='C')
pdf.text(20, 50, "Name: Charlie Conflict")
pdf.text(20, 60, "Date of Birth: 10-10-1995")
pdf.text(20, 70, "Degree: Bachelor of Arts")
# Ambiguous CGPA line to force a disagreement between OpenAI and Gemini
pdf.text(20, 80, "CGPA (Current): 3.5    |    CGPA (Final Adjusted): 3.9")
pdf.text(20, 90, "Graduation Year: 2021 (Expected) / 2023 (Actual)")
pdf.output("test_conflict.pdf")

print("Generated test_forgery.pdf, test_consensus.pdf, test_conflict.pdf")
