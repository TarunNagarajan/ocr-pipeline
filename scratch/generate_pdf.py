from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

# Write a header
pdf.cell(200, 10, txt="Spatial-Semantic Projection Test", ln=1, align='C')

# Write a structured row (like a transcript table)
pdf.set_font("Arial", 'B', 12)
pdf.text(20, 40, "Subject")
pdf.text(100, 40, "Grade")
pdf.text(160, 40, "Credits")

pdf.set_font("Arial", '', 12)
pdf.text(20, 50, "Advanced Physics")
pdf.text(100, 50, "A+")
pdf.text(160, 50, "4.0")

pdf.text(20, 60, "Computer Science")
pdf.text(100, 60, "A")
pdf.text(160, 60, "3.5")

pdf.output("spatial_test.pdf")
print("PDF generated: spatial_test.pdf")
