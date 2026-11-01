from PIL import Image, ImageDraw, ImageFont
import os

def make_icon():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Main icon 256x256
    size = 256
    img = Image.new('RGB', (size, size), color='#ffffff')
    draw = ImageDraw.Draw(img)
    
    # Draw simple cart
    blue = '#2563eb'
    # basket
    draw.rectangle([60, 90, 190, 150], outline=blue, width=8)
    # handle
    draw.line([60, 90, 40, 70], fill=blue, width=8)
    draw.line([40, 70, 30, 70], fill=blue, width=8)
    # wheels
    draw.ellipse([80, 150, 105, 175], outline=blue, width=8)
    draw.ellipse([150, 150, 175, 175], outline=blue, width=8)
    
    # Text
    try:
        font = ImageFont.truetype("arialbd.ttf", 24)
    except:
        font = ImageFont.load_default()
    
    text = "AUTOSERVICIO"
    bbox = draw.textbbox((0,0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((size-w)/2, 190), text, fill=blue, font=font)
    
    png_path = os.path.join(out_dir, 'icon.png')
    img.save(png_path)
    
    # Create ICO with multiple sizes
    ico_path = os.path.join(out_dir, 'icon.ico')
    icon_sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
    img.save(ico_path, format='ICO', sizes=icon_sizes)
    print('Created:', ico_path)
    
    # Wizard image 164x314
    wimg = Image.new('RGB', (164, 314), color='#f8fafc')
    d2 = ImageDraw.Draw(wimg)
    d2.rectangle([40, 60, 124, 110], outline=blue, width=6)
    d2.line([40, 60, 25, 45], fill=blue, width=6)
    d2.line([25, 45, 18, 45], fill=blue, width=6)
    d2.ellipse([55, 110, 72, 127], outline=blue, width=6)
    d2.ellipse([98, 110, 115, 127], outline=blue, width=6)
    try:
        f2 = ImageFont.truetype("arialbd.ttf", 12)
    except:
        f2 = ImageFont.load_default()
    t2 = "AUTOSERVICIO"
    b2 = d2.textbbox((0,0), t2, font=f2)
    d2.text(((164 - (b2[2]-b2[0]))/2, 140), t2, fill=blue, font=f2)
    wbmppath = os.path.join(out_dir, 'installer-wizard.bmp')
    wimg.save(wbmppath, format='BMP')
    print('Created:', wbmppath)
    
    # Small wizard 55x58
    sw = Image.new('RGB', (55, 58), color='#f8fafc')
    d3 = ImageDraw.Draw(sw)
    d3.rectangle([12, 18, 38, 35], outline=blue, width=4)
    d3.line([12, 18, 7, 13], fill=blue, width=4)
    d3.line([7, 13, 4, 13], fill=blue, width=4)
    d3.ellipse([16, 35, 23, 42], outline=blue, width=4)
    d3.ellipse([29, 35, 36, 42], outline=blue, width=4)
    try:
        f3 = ImageFont.truetype("arialbd.ttf", 6)
    except:
        f3 = ImageFont.load_default()
    t3 = "AUTOSERVICIO"
    b3 = d3.textbbox((0,0), t3, font=f3)
    d3.text(((55 - (b3[2]-b3[0]))/2, 44), t3, fill=blue, font=f3)
    swbmppath = os.path.join(out_dir, 'installer-wizard-small.bmp')
    sw.save(swbmppath, format='BMP')
    print('Created:', swbmppath)

if __name__ == '__main__':
    make_icon()
