import { publicConfig } from '../server/lib.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({message:'Method not allowed'});
  return res.status(200).json(publicConfig());
}
