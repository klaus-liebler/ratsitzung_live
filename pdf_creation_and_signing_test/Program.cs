using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using iText.Bouncycastleconnector;
using iText.Commons.Bouncycastle.Cert;
using iText.IO.Font.Constants;
using iText.Html2pdf;
using iText.Kernel.Font;
using iText.Kernel.Colors;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas;
using iText.Layout;
using iText.Layout.Properties;
using iText.Signatures;
using Markdig;
using Rectangle = iText.Kernel.Geom.Rectangle;

const string RootCaCertPath = @"C:\Users\klaus\OneDrive - HSOS\certificates\rootCA.pem.crt";
const string RootCaKeyPath = @"C:\Users\klaus\OneDrive - HSOS\certificates\rootCA.pem.key";
const string DocumentTitle = "RatLive Testprotokoll";
const string OrganizationName = "Stadt Greven";
const string CommitteeName = "Rat der Stadt Greven";
const string DocumentStatus = "Entwurf fuer Techniktest";
const string DocumentVersion = "v1-Teststand";
const string Classification = "Intern";

const string ProtocolPdf = "protocol.pdf";
const string ProtocolSigA = "protocol_sigA.pdf";
const string ProtocolSigASigB = "protocol_sigA_sigB.pdf";

var workDir = Directory.GetCurrentDirectory();
var repoRoot = Directory.GetParent(workDir)?.FullName ?? workDir;
var protocolPdfPath = Path.Combine(workDir, ProtocolPdf);
var protocolSigAPath = Path.Combine(workDir, ProtocolSigA);
var protocolSigASigBPath = Path.Combine(workDir, ProtocolSigASigB);
var imagePath = Path.Combine(workDir, "test-image.png");
var logoPath = Path.Combine(repoRoot, "Logo_Stadt Greven.svg");

Console.WriteLine($"Arbeitsverzeichnis: {workDir}");
EnsureTestImage(imagePath);

var topImageUri = File.Exists(logoPath)
	? new Uri(logoPath).AbsoluteUri
	: new Uri(imagePath).AbsoluteUri;
var bodyImageUri = new Uri(imagePath).AbsoluteUri;

var markdown = BuildMarkdown(topImageUri, bodyImageUri);
CreatePdfFromMarkdown(markdown, workDir, protocolPdfPath);
Console.WriteLine($"PDF erstellt: {protocolPdfPath}");

var rootCa = LoadRootCaCertificate(RootCaCertPath, RootCaKeyPath);

var userACert = CreateUserCertificate("UserA", rootCa);
var userBCert = CreateUserCertificate("UserB", rootCa);

File.WriteAllBytes(Path.Combine(workDir, "UserA.pfx"), userACert.Export(X509ContentType.Pfx));
File.WriteAllBytes(Path.Combine(workDir, "UserB.pfx"), userBCert.Export(X509ContentType.Pfx));

SignPdf(protocolPdfPath, protocolSigAPath, userACert, rootCa, "UserA-Signatur");
Console.WriteLine($"1. Signatur erstellt: {protocolSigAPath}");

SignPdf(protocolSigAPath, protocolSigASigBPath, userBCert, rootCa, "UserB-Signatur");
Console.WriteLine($"2. Signatur erstellt: {protocolSigASigBPath}");

Console.WriteLine("Fertig.");

static void EnsureTestImage(string imagePath)
{
	if (File.Exists(imagePath))
	{
		return;
	}

	// 1x1 PNG Pixel (rot)
	const string base64Png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wf7xW8AAAAASUVORK5CYII=";
	var bytes = Convert.FromBase64String(base64Png);
	File.WriteAllBytes(imagePath, bytes);
}

static string BuildMarkdown(string topImageUri, string bodyImageUri)
{
	return $@"# Testprotokoll

<p><img src=""{topImageUri}"" alt=""Logo"" style=""max-width:240px; margin-bottom:18px;"" /></p>

## Ueberschrift Ebene 2

Dies ist ein **Testtext** fuer die Markdown-zu-PDF-Umwandlung.

### Liste

- Punkt 1
- Punkt 2
- Punkt 3

### Bild

![Testbild]({bodyImageUri})

### Tabelle

| Name  | Rolle                | Stimme |
|-------|----------------------|--------|
| UserA | Protokollfuehrer     | Ja     |
| UserB | Vorsitzender         | Nein   |
| UserC | Ratsmitglied         | Enth.  |
";
}

static void CreatePdfFromMarkdown(string markdown, string baseUri, string outputPdfPath)
{
	var pipeline = new MarkdownPipelineBuilder()
		.UseAdvancedExtensions()
		.Build();

	var htmlBody = Markdown.ToHtml(markdown, pipeline);
		var html = $@"<!doctype html>
<html>
<head>
	<meta charset=""utf-8"" />
	<style>
		body {{ font-family: Arial, Helvetica, sans-serif; font-size: 12pt; margin: 90px 48px 70px 48px; }}
		h1, h2, h3 {{ color: #1f3b5b; }}
		table {{ border-collapse: collapse; width: 100%; margin-top: 10px; }}
		th, td {{ border: 1px solid #777; padding: 6px; text-align: left; }}
		img {{ max-width: 220px; border: 1px solid #ddd; padding: 4px; }}
	</style>
</head>
<body>
{htmlBody}
</body>
</html>";

	var properties = new ConverterProperties();
	properties.SetBaseUri(baseUri);

	using var stream = new FileStream(outputPdfPath, FileMode.Create, FileAccess.Write);
	HtmlConverter.ConvertToPdf(html, stream, properties);
	AddHeaderAndFooter(outputPdfPath);
}

static void AddHeaderAndFooter(string pdfPath)
{
	var tempPath = Path.Combine(Path.GetDirectoryName(pdfPath) ?? ".", $"{Path.GetFileNameWithoutExtension(pdfPath)}_tmp{Path.GetExtension(pdfPath)}");

	using var reader = new PdfReader(pdfPath);
	using var writer = new PdfWriter(tempPath);
	using var pdf = new PdfDocument(reader, writer);
	var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
	var boldFont = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
	var pageCount = pdf.GetNumberOfPages();
	var generatedAt = DateTime.Now;

	for (var pageNumber = 1; pageNumber <= pageCount; pageNumber++)
	{
		var page = pdf.GetPage(pageNumber);
		var pageSize = page.GetPageSize();
		var pdfCanvas = new PdfCanvas(page.NewContentStreamAfter(), page.GetResources(), pdf);
		DrawHeaderFooterLines(pdfCanvas, pageSize);
		using var canvas = new Canvas(pdfCanvas, pageSize);

		canvas.SetFont(boldFont).SetFontSize(10).SetFontColor(new DeviceRgb(31, 59, 91));
		canvas.ShowTextAligned(OrganizationName, 36, pageSize.GetTop() - 24, TextAlignment.LEFT);
		canvas.ShowTextAligned(DocumentTitle, pageSize.GetWidth() / 2, pageSize.GetTop() - 24, TextAlignment.CENTER);

		canvas.SetFont(font).SetFontSize(8).SetFontColor(ColorConstants.BLACK);
		canvas.ShowTextAligned(CommitteeName, 36, pageSize.GetTop() - 38, TextAlignment.LEFT);
		canvas.ShowTextAligned($"Status: {DocumentStatus}", pageSize.GetWidth() / 2, pageSize.GetTop() - 38, TextAlignment.CENTER);
		canvas.ShowTextAligned($"Version: {DocumentVersion}", pageSize.GetRight() - 36, pageSize.GetTop() - 38, TextAlignment.RIGHT);

		canvas.ShowTextAligned($"Klassifikation: {Classification}", 36, pageSize.GetBottom() + 24, TextAlignment.LEFT);
		canvas.ShowTextAligned($"Erzeugt am {generatedAt:dd.MM.yyyy HH:mm}", pageSize.GetWidth() / 2, pageSize.GetBottom() + 24, TextAlignment.CENTER);
		canvas.ShowTextAligned($"Seite {pageNumber} / {pageCount}", pageSize.GetRight() - 36, pageSize.GetBottom() + 24, TextAlignment.RIGHT);

		canvas.ShowTextAligned("Digitale Signaturen: Protokollfuehrung / Vorsitz", 36, pageSize.GetBottom() + 12, TextAlignment.LEFT);
	}

	pdf.Close();
	File.Delete(pdfPath);
	File.Move(tempPath, pdfPath);
}

static void DrawHeaderFooterLines(PdfCanvas pdfCanvas, Rectangle pageSize)
{
	pdfCanvas
		.SaveState()
		.SetLineWidth(0.8f)
		.SetStrokeColor(new DeviceRgb(31, 59, 91))
		.MoveTo(36, pageSize.GetTop() - 46)
		.LineTo(pageSize.GetRight() - 36, pageSize.GetTop() - 46)
		.Stroke()
		.SetLineWidth(0.5f)
		.SetStrokeColor(new DeviceRgb(120, 120, 120))
		.MoveTo(36, pageSize.GetBottom() + 30)
		.LineTo(pageSize.GetRight() - 36, pageSize.GetBottom() + 30)
		.Stroke()
		.RestoreState();
}

static X509Certificate2 LoadRootCaCertificate(string caCertPath, string caKeyPath)
{
	if (!File.Exists(caCertPath))
	{
		throw new FileNotFoundException("Root-CA-Zertifikat nicht gefunden", caCertPath);
	}

	if (!File.Exists(caKeyPath))
	{
		throw new FileNotFoundException("Root-CA-Key nicht gefunden", caKeyPath);
	}

	var certWithKey = X509Certificate2.CreateFromPemFile(caCertPath, caKeyPath);

	// Reimport als PFX, damit private Key-Operationen fuer Signierung stabil funktionieren.
	var pfx = certWithKey.Export(X509ContentType.Pfx);
	return X509CertificateLoader.LoadPkcs12(
		pfx,
		(string?)null,
		X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);
}

static X509Certificate2 CreateUserCertificate(string commonName, X509Certificate2 issuerCa)
{
	using var userKey = RSA.Create(2048);
	var request = new CertificateRequest(
		$"CN={commonName}",
		userKey,
		HashAlgorithmName.SHA256,
		RSASignaturePadding.Pkcs1);

	request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
	request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, true));
	request.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(request.PublicKey, false));

	var serial = RandomNumberGenerator.GetBytes(16);
	var notBefore = DateTimeOffset.UtcNow.AddMinutes(-5);
	var notAfter = DateTimeOffset.UtcNow.AddYears(2);

	var issued = request.Create(issuerCa, notBefore, notAfter, serial);
	var withPrivateKey = issued.CopyWithPrivateKey(userKey);

	var pfx = withPrivateKey.Export(X509ContentType.Pfx);
	return X509CertificateLoader.LoadPkcs12(
		pfx,
		(string?)null,
		X509KeyStorageFlags.Exportable | X509KeyStorageFlags.EphemeralKeySet);
}

static void SignPdf(string sourcePath, string destinationPath, X509Certificate2 signingCert, X509Certificate2 issuerCa, string reason)
{
	using var reader = new PdfReader(sourcePath);
	using var output = new FileStream(destinationPath, FileMode.Create, FileAccess.Write);

	var signerProperties = new SignerProperties()
		.SetFieldName($"sig_{signingCert.GetNameInfo(X509NameType.SimpleName, false)}_{DateTime.UtcNow:yyyyMMddHHmmssfff}")
		.SetReason(reason)
		.SetLocation("Greven");

	var signer = new PdfSigner(reader, output, null, new StampingProperties().UseAppendMode(), signerProperties);

	using var rsa = signingCert.GetRSAPrivateKey() ?? throw new InvalidOperationException("Signierendes Zertifikat enthält keinen RSA-Private-Key.");
	using var rsaCsp = new RSACryptoServiceProvider();
	rsaCsp.ImportParameters(rsa.ExportParameters(true));

	IExternalSignature externalSignature = new AsymmetricAlgorithmSignature(rsaCsp, "SHA256");
	IExternalDigest externalDigest = new BouncyCastleDigest();

	var factory = BouncyCastleFactoryCreator.GetFactory();
	IX509Certificate[] chain =
	[
		ToIX509Certificate(factory, signingCert),
		ToIX509Certificate(factory, issuerCa)
	];

	signer.SignDetached(
		externalDigest,
		externalSignature,
		chain,
		null,
		null,
		null,
		0,
		PdfSigner.CryptoStandard.CADES);
}

static IX509Certificate ToIX509Certificate(iText.Commons.Bouncycastle.IBouncyCastleFactory factory, X509Certificate2 cert)
{
	using var certStream = new MemoryStream(cert.Export(X509ContentType.Cert));
	return factory.CreateX509Certificate(certStream);
}
