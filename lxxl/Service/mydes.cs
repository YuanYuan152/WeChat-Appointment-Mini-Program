using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using ThoughtWorks.QRCode.Codec;

namespace lxxl.Service
{
    /// <summary>
    /// DES加密解密算法
    /// </summary>
    public class mydes
    {
        /// <summary>
        /// DES加密算法
        /// sKey为8位或16位
        /// </summary>
        /// <param name="pToEncrypt">需要加密的字符串</param>
        /// <param name="sKey">密钥</param>
        /// <returns></returns>
        public static string DesEncrypt(string pToEncrypt, string sKey = "20161225")//12345678
        {
            StringBuilder strRetValue = new StringBuilder();

            try
            {
                byte[] keyBytes = Encoding.UTF8.GetBytes(sKey.Substring(0, 8));
                byte[] keyIV = keyBytes;
                byte[] inputByteArray = Encoding.UTF8.GetBytes(pToEncrypt);
                DESCryptoServiceProvider provider = new DESCryptoServiceProvider();

                provider.Mode = CipherMode.ECB;//兼容其他语言的Des加密算法  
                provider.Padding = PaddingMode.Zeros;//自动补0

                MemoryStream mStream = new MemoryStream();
                CryptoStream cStream = new CryptoStream(mStream, provider.CreateEncryptor(keyBytes, keyIV), CryptoStreamMode.Write);
                cStream.Write(inputByteArray, 0, inputByteArray.Length);
                cStream.FlushFinalBlock();

                //不使用base64编码
                //return Convert.ToBase64String(mStream.ToArray()); 

                //组织成16进制字符串            
                foreach (byte b in mStream.ToArray())
                {
                    strRetValue.AppendFormat("{0:X2}", b);
                }
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
            }

            return strRetValue.ToString();
        }

        /// <summary>
        /// DES解密算法
        /// sKey为8位或16位
        /// </summary>
        /// <param name="pToDecrypt">需要解密的字符串</param>
        /// <param name="sKey">密钥</param>
        /// <returns></returns>
        public static string DesDecrypt(string pToDecrypt, string sKey = "20161225")
        {
            string strRetValue = "";

            try
            {
                byte[] keyBytes = Encoding.UTF8.GetBytes(sKey.Substring(0, 8));
                byte[] keyIV = keyBytes;

                //不使用base64解码
                //byte[] inputByteArray = Convert.FromBase64String(decryptString);

                //16进制转换为byte字节
                byte[] inputByteArray = new byte[pToDecrypt.Length / 2];
                for (int x = 0; x < pToDecrypt.Length / 2; x++)
                {
                    int i = (Convert.ToInt32(pToDecrypt.Substring(x * 2, 2), 16));
                    inputByteArray[x] = (byte)i;
                }

                DESCryptoServiceProvider provider = new DESCryptoServiceProvider();

                provider.Mode = CipherMode.ECB;//兼容其他语言的Des加密算法  
                provider.Padding = PaddingMode.Zeros;//自动补0  

                MemoryStream mStream = new MemoryStream();
                CryptoStream cStream = new CryptoStream(mStream, provider.CreateDecryptor(keyBytes, keyIV), CryptoStreamMode.Write);
                cStream.Write(inputByteArray, 0, inputByteArray.Length);
                cStream.FlushFinalBlock();

                //需要去掉结尾的null字符
                //strRetValue = Encoding.UTF8.GetString(mStream.ToArray());
                strRetValue = Encoding.UTF8.GetString(mStream.ToArray()).TrimEnd('\0');
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
            }

            return strRetValue;
        }


        /// <summary>
        /// 生成二维码，如果有Logo，则在二维码中添加Logo
        /// </summary>
        /// <param name="content"></param>
        /// <returns></returns>
        public static Bitmap CreateQRCode(string content)
        {
            QRCodeEncoder qrEncoder = new QRCodeEncoder();
            qrEncoder.QRCodeEncodeMode = QRCodeEncoder.ENCODE_MODE.BYTE;
            qrEncoder.QRCodeScale = 4;
            qrEncoder.QRCodeVersion = 7;
            qrEncoder.QRCodeErrorCorrect = QRCodeEncoder.ERROR_CORRECTION.M;
            try
            {
                Bitmap qrcode = qrEncoder.Encode(content, Encoding.UTF8);
                //if (!logoImagepath.Equals(string.Empty))
                //{
                //    Graphics g = Graphics.FromImage(qrcode);
                //    Bitmap bitmapLogo = new Bitmap(logoImagepath);
                //    int logoSize = 30;
                //    bitmapLogo = new Bitmap(bitmapLogo, new System.Drawing.Size(logoSize, logoSize));
                //    PointF point = new PointF(qrcode.Width / 2 - logoSize / 2, qrcode.Height / 2 - logoSize / 2);
                //    g.DrawImage(bitmapLogo, point);
                //}
                return qrcode;
            }
            catch (IndexOutOfRangeException ex)
            {
                return new Bitmap(100, 100);
            }
            catch (Exception ex)
            {
                return new Bitmap(100, 100);
            }
        }

        /// <summary>
        /// 保存二维码，并为二维码添加白色背景。
        /// </summary>
        /// <param name="path"></param>
        public static void SaveQRCode(Bitmap bimg, string path)
        {
            if (bimg != null)
            {
                Bitmap bitmap = new Bitmap(bimg.Width + 10, bimg.Height + 10);
                Graphics g = Graphics.FromImage(bitmap);
                g.FillRectangle(System.Drawing.Brushes.White, 0, 0, bitmap.Width, bitmap.Height);
                g.DrawImage(bimg, new PointF(5, 5));
                bitmap.Save(path, System.Drawing.Imaging.ImageFormat.Png);
                bitmap.Dispose();
            }
        }

    }
}