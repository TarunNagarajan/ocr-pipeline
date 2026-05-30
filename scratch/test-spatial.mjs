import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({project: 'project-f491a721-1890-46bd-a8a', location: 'global', vertexai: true});
const img = fs.readFileSync('C:/Users/ultim/.gemini/antigravity-cli/brain/29b77f9c-bce4-410c-9d26-e670a633226d/french_passport_1780116420501.png').toString('base64');

async function main() {
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {inlineData: {mimeType: 'image/png', data: img}},
      {text: 'Extract the document number, surname, and given names along with their bounding boxes [ymin, xmin, ymax, xmax] scaled 0-1000.'}
    ],
    config: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          fields: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                key: {type: 'STRING'},
                value: {type: 'STRING'},
                bbox: {type: 'ARRAY', items: {type: 'NUMBER'}}
              }
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(JSON.parse(res.text), null, 2));
}

main().catch(console.error);
