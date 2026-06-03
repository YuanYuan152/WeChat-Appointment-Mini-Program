using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Net;
using System.IO;
using System.Text;
namespace lxxl.Service
{
    public class WebHelper
    {
        public string Request_WebRequest(string uri, int timeout, Encoding encoding)
        {
            string result = string.Empty;

            //ServicePointManager.CertificatePolicy = new AcceptAllCertificatePolicy();
            //ServicePointManager.SecurityProtocol = SecurityProtocolType.Ssl3;

            WebRequest request = WebRequest.Create(new Uri(uri));

            if (timeout > 0)
                request.Timeout = timeout;

            WebResponse response = request.GetResponse();
            Stream stream = response.GetResponseStream();
            StreamReader sr = encoding == null ? new StreamReader(stream) : new StreamReader(stream, encoding);

            result = sr.ReadToEnd();

            sr.Close();
            stream.Close();

            return result;
        }
    }
}