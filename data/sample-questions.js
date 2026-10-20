/* Sample questions — 5 per subject, all sample:true. Loaded only on user action. */
(function () {
  window.App = window.App || {};
  App.sampleQuestions = [
    /* ---------------- Data Engineering (5) ---------------- */
    {
      id: 'de-001',
      subject: 'data-engineering',
      topic: 'พื้นฐานระบบข้อมูล',
      question: 'ข้อใดอธิบายความแตกต่างระหว่าง Data Lake กับ Data Warehouse ได้ถูกต้องที่สุด',
      choices: [
        'Data Lake เก็บข้อมูลได้ทุกแบบรวมถึงข้อมูลดิบ ส่วน Data Warehouse มักเก็บข้อมูลที่จัดโครงสร้างและผ่านการทำความสะอาดแล้ว',
        'Data Lake เก็บได้เฉพาะข้อมูลตาราง ส่วน Data Warehouse เก็บได้ทั้งรูปภาพและวิดีโอ',
        'Data Lake และ Data Warehouse เก็บข้อมูลได้เหมือนกันทุกประการ ต่างกันแค่ราคา',
        'Data Warehouse ใช้เก็บข้อมูลชั่วคราว ส่วน Data Lake เก็บข้อมูลถาวร'
      ],
      answer: 0,
      explanation:
        'Data Lake เหมาะกับข้อมูลดิบหลากหลายรูปแบบ (structured, semi-structured, unstructured) ส่วน Data Warehouse เน้นข้อมูลที่ผ่านการ transform และจัด schema แล้วเพื่อการวิเคราะห์',
      whyWrong: [
        null,
        'สลับกัน — Data Lake ต่างหากที่ยืดหยุ่นเรื่องชนิดข้อมูล',
        'ไม่จริง ทั้งสองมีบทบาทและรูปแบบการใช้งานต่างกัน',
        'ไม่ใช่เกณฑ์การแบ่งประเภทนี้'
      ],
      difficulty: 1
    },
    {
      id: 'de-002',
      subject: 'data-engineering',
      topic: 'พื้นฐานระบบข้อมูล',
      question: 'ETL กับ ELT ต่างกันที่ขั้นตอนใดเป็นหลัก',
      choices: [
        'ETL ทำ transform ก่อน load ส่วน ELT load ข้อมูลดิบก่อนแล้วค่อย transform ในปลายทาง',
        'ETL ใช้เฉพาะข้อมูล JSON ส่วน ELT ใช้เฉพาะข้อมูล CSV',
        'ETL ไม่มีการ load ข้อมูล ส่วน ELT ไม่มีการ transform',
        'ETL ทำงานบนคลาวด์เท่านั้น ส่วน ELT ทำงานบนเครื่อง local'
      ],
      answer: 0,
      explanation:
        'ความต่างหลักอยู่ที่ลำดับ: ETL = Extract → Transform → Load, ELT = Extract → Load → Transform (มักอาศัยพลังประมวลผลของปลายทาง เช่น คลังข้อมูลสมัยใหม่)',
      whyWrong: [
        null,
        'ไม่เกี่ยวกับชนิดไฟล์',
        'ทั้งสองมีทั้ง transform และ load',
        'ไม่เกี่ยวกับสถานที่ทำงาน'
      ],
      difficulty: 1
    },
    {
      id: 'de-003',
      subject: 'data-engineering',
      topic: 'คุณภาพข้อมูล',
      question: 'ค่าที่หายไป (missing value) ในคอลัมน์ตัวเลข ควรจัดการอย่างไรจึงเหมาะสมที่สุดเมื่อต้องนำไปใช้กับโมเดล ML',
      choices: [
        'ลบแถวนั้นทิ้งทันทีโดยไม่ต้องดูอะไร',
        'เลือกวิธีตามบริบท เช่น เติมค่าด้วยค่ากลาง (median) หรือใช้โมเดลเติมค่า และบันทึกเหตุผลไว้',
        'เติมค่าด้วย 0 เสมอ เพราะปลอดภัยที่สุด',
        'ปล่อยไว้แล้วให้โมเดลจัดการเอง ไม่ต้องทำอะไร'
      ],
      answer: 1,
      explanation:
        'ไม่มีวิธีเดียวที่ถูกทุกสถานการณ์ การเลือกวิธีควรอิงบริบทของข้อมูล ผลกระทบต่อการวิเคราะห์ และควรบันทึกเหตุผลเพื่อความโปร่งใส',
      whyWrong: [
        'การลบทันทีอาจทำให้เสียข้อมูลจำนวนมากและเกิด bias',
        null,
        'การเติม 0 อาจบิดเบือนสถิติ เช่น ค่าเฉลี่ย',
        'โมเดลส่วนใหญ่ไม่รองรับ missing value โดยตรง'
      ],
      difficulty: 2
    },
    {
      id: 'de-004',
      subject: 'data-engineering',
      topic: 'คุณภาพข้อมูล',
      question: 'ข้อใดเป็นตัวอย่างของ "data quality issue" ประเภทความสอดคล้อง (consistency)',
      choices: [
        'ชื่อลูกค้าถูกพิมพ์ผิด',
        'วันเกิดของลูกค้าคนเดียวกันถูกบันทึกต่างกันในสองระบบ',
        'คอลัมน์เบอร์โทรศัพท์มีค่าว่าง',
        'ราคาสินค้าเป็นค่าลบ'
      ],
      answer: 1,
      explanation:
        'Consistency คือข้อมูลเดียวกันต้องตรงกันข้ามระบบ การที่วันเกิดขัดกันระหว่างสองระบบคือปัญหาความสอดคล้องโดยตรง',
      whyWrong: [
        'เป็นปัญหา accuracy',
        null,
        'เป็นปัญหา completeness',
        'เป็นปัญหา validity'
      ],
      difficulty: 2
    },
    {
      id: 'de-005',
      subject: 'data-engineering',
      topic: 'ไปป์ไลน์ข้อมูล',
      question: 'ข้อใดกล่าวถึง batch processing กับ stream processing ถูกต้อง',
      choices: [
        'Batch ประมวลผลเป็นรอบ ๆ ตามช่วงเวลา ส่วน stream ประมวลผลต่อเนื่องเมื่อมีข้อมูลเข้ามา',
        'Batch เร็วกว่า stream เสมอ',
        'Stream ใช้ได้เฉพาะข้อมูลขนาดเล็ก',
        'ทั้งสองแบบใช้เครื่องมือเดียวกันและตั้งค่าเหมือนกัน'
      ],
      answer: 0,
      explanation:
        'Batch ทำงานเป็นรอบ (เช่น ทุกชั่วโมง/ทุกวัน) ส่วน stream ทำงานต่อเนื่องแบบ near real-time',
      whyWrong: [
        null,
        'ความเร็วขึ้นกับงาน ไม่ใช่ชนิดการประมวลผล',
        'Stream รองรับข้อมูลปริมาณมากได้',
        'เครื่องมือและแนวคิดการตั้งค่าต่างกัน'
      ],
      difficulty: 2
    },

    /* ---------------- Marketing Innovation (5) ---------------- */
    {
      id: 'mi-001',
      subject: 'marketing-innovation',
      topic: 'พื้นฐานการตลาด',
      question: 'ส่วนผสมการตลาด (4Ps) ประกอบด้วยอะไรบ้าง',
      choices: [
        'Product, Price, Place, Promotion',
        'People, Process, Physical Evidence, Productivity',
        'Product, People, Profit, Planet',
        'Plan, Price, Promote, Produce'
      ],
      answer: 0,
      explanation:
        '4Ps ดั้งเดิมของ McCarthy คือ Product, Price, Place, Promotion',
      whyWrong: [
        null,
        'นี่คือ 4Ps เพิ่มเติมใน Service Marketing (7Ps)',
        'ไม่ใช่ 4Ps มาตรฐาน',
        'ไม่ใช่คำศัพท์มาตรฐาน'
      ],
      difficulty: 1
    },
    {
      id: 'mi-002',
      subject: 'marketing-innovation',
      topic: 'พื้นฐานการตลาด',
      question: 'STP ในทางการตลาดย่อมาจากอะไร',
      choices: [
        'Sales, Target, Promotion',
        'Segmentation, Targeting, Positioning',
        'Strategy, Tactics, Performance',
        'Service, Technology, Product'
      ],
      answer: 1,
      explanation:
        'STP = Segmentation (แบ่งกลุ่ม), Targeting (เลือกกลุ่มเป้าหมาย), Positioning (วางตำแหน่งผลิตภัณฑ์)',
      whyWrong: [
        'ไม่ใช่คำย่อมาตรฐาน',
        null,
        'ไม่ใช่คำย่อมาตรฐาน',
        'ไม่ใช่คำย่อมาตรฐาน'
      ],
      difficulty: 1
    },
    {
      id: 'mi-003',
      subject: 'marketing-innovation',
      topic: 'นวัตกรรมการตลาด',
      question: 'ข้อใดเป็นตัวอย่างของ "blue ocean strategy" ที่ดีที่สุด',
      choices: [
        'ลดราคาสินค้าลงครึ่งหนึ่งเพื่อแย่งลูกค้าจากคู่แข่ง',
        'สร้างตลาดใหม่ที่ไม่มีคู่แข่งโดยตรง เช่น เปลี่ยนกลุ่มลูกค้าเป้าหมายหรือคุณค่าที่ส่งมอบ',
        'โฆษณาให้มากขึ้นในช่องทางเดิม',
        'เพิ่มฟีเจอร์ให้สินค้าจนครบทุกอย่าง'
      ],
      answer: 1,
      explanation:
        'Blue Ocean Strategy เน้นสร้างพื้นที่ตลาดใหม่ ( uncontested market space) มากกว่าการแข่งขันในตลาดเดิม',
      whyWrong: [
        'เป็นการแข่งขันใน red ocean',
        null,
        'ยังเป็นการแข่งขันในตลาดเดิม',
        'การเพิ่มฟีเจอร์ไม่ใช่แก่นของ blue ocean'
      ],
      difficulty: 2
    },
    {
      id: 'mi-004',
      subject: 'marketing-innovation',
      topic: 'นวัตกรรมการตลาด',
      question: 'Customer Journey Map ใช้เพื่ออะไรเป็นหลัก',
      choices: [
        'คำนวณกำไรสุทธิของแคมเปญ',
        'ทำความเข้าใจประสบการณ์และจุดสัมผัสของลูกค้าในแต่ละช่วง',
        'ออกแบบโลโก้บริษัท',
        'กำหนดราคาสินค้า'
      ],
      answer: 1,
      explanation:
        'Customer Journey Map แสดงเส้นทางประสบการณ์ของลูกค้าตั้งแต่รู้จักจนถึงหลังการซื้อ ช่วยหาจุดที่ต้องปรับปรุง',
      whyWrong: [
        'ไม่ใช่เครื่องมือคำนวณกำไร',
        null,
        'ไม่เกี่ยวกับการออกแบบโลโก้',
        'ไม่ใช่เครื่องมือกำหนดราคาโดยตรง'
      ],
      difficulty: 2
    },
    {
      id: 'mi-005',
      subject: 'marketing-innovation',
      topic: 'การวัดผล',
      question: 'ตัวชี้วัดใดเหมาะที่สุดสำหรับวัดผลแคมเปญโฆษณาออนไลน์ในเรื่อง "การมีส่วนร่วม"',
      choices: [
        'ยอดขายรวมรายปี',
        'อัตราการคลิก (CTR) และอัตราการมีส่วนร่วม (engagement rate)',
        'จำนวนพนักงานฝ่ายขาย',
        'ราคาต้นทุนวัตถุดิบ'
      ],
      answer: 1,
      explanation:
        'CTR และ engagement rate วัดปฏิสัมพันธ์กับโฆษณาโดยตรง เหมาะกับการวัดการมีส่วนร่วม',
      whyWrong: [
        'ยอดขายรายปีไม่จำเพาะกับแคมเปญ',
        null,
        'ไม่เกี่ยวกับแคมเปญโฆษณา',
        'ไม่เกี่ยวกับการมีส่วนร่วม'
      ],
      difficulty: 1
    },

    /* ---------------- Feature Engineering (5) ---------------- */
    {
      id: 'fe-001',
      subject: 'feature-engineering',
      topic: 'พื้นฐานฟีเจอร์',
      question: 'one-hot encoding เหมาะกับสถานการณ์ใด',
      choices: [
        'ตัวแปรเชิงหมวดหมู่ (categorical) ที่มีจำนวนหมวดไม่มาก',
        'ตัวแปรต่อเนื่องที่มีค่ามาก ๆ',
        'ข้อความยาวหลายย่อหน้า',
        'รูปภาพความละเอียดสูง'
      ],
      answer: 0,
      explanation:
        'one-hot สร้างคอลัมน์ไบนารีให้แต่ละหมวด เหมาะกับ categorical ที่มีจำนวนหมวดจำกัด',
      whyWrong: [
        null,
        'ตัวแปรต่อเนื่องมักใช้การ standardize/normalize แทน',
        'ข้อความใช้เทคนิคอื่น เช่น TF-IDF หรือ embedding',
        'รูปภาพใช้ convolution หรือ embedding จากโมเดลภาพ'
      ],
      difficulty: 1
    },
    {
      id: 'fe-002',
      subject: 'feature-engineering',
      topic: 'พื้นฐานฟีเจอร์',
      question: 'การ normalize ข้อมูลตัวเลขต่างจากการ standardize อย่างไร',
      choices: [
        'normalize ปรับสเกลเป็นช่วงหนึ่ง (เช่น 0–1) ส่วน standardize ปรับให้มีค่าเฉลี่ย 0 และส่วนเบี่ยงเบนมาตรฐาน 1',
        'normalize ใช้กับข้อความ ส่วน standardize ใช้กับตัวเลข',
        'ทั้งสองเหมือนกันทุกประการ',
        'standardize ใช้ได้เฉพาะข้อมูลที่มีการแจกแจงปกติเท่านั้น'
      ],
      answer: 0,
      explanation:
        'Normalization (min-max) ปรับช่วงค่า, Standardization (z-score) ปรับให้ mean=0, std=1',
      whyWrong: [
        null,
        'ทั้งสองใช้กับตัวเลข',
        'ไม่เหมือนกัน',
        'ใช้ได้กับข้อมูลหลากหลาย ไม่จำกัดเฉพาะ normal distribution'
      ],
      difficulty: 2
    },
    {
      id: 'fe-003',
      subject: 'feature-engineering',
      topic: 'การสร้างฟีเจอร์',
      question: 'การสร้างฟีเจอร์ "อายุของลูกค้าเป็นช่วง" (เช่น 18–24, 25–34) จากตัวแปรอายุ เรียกว่าอะไร',
      choices: [
        'การทำ discretization / binning',
        'การทำ one-hot encoding',
        'การทำ data leakage',
        'การทำ oversampling'
      ],
      answer: 0,
      explanation:
        'การแบ่งค่าต่อเนื่องเป็นช่วง ๆ เรียกว่า discretization หรือ binning',
      whyWrong: [
        null,
        'one-hot ใช้กับ categorical',
        'data leakage คือปัญหา ไม่ใช่เทคนิค',
        'oversampling ใช้กับความไม่สมดุลของคลาส'
      ],
      difficulty: 2
    },
    {
      id: 'fe-004',
      subject: 'feature-engineering',
      topic: 'กับดักที่พบบ่อย',
      question: 'data leakage ในงาน feature engineering หมายถึงอะไร',
      choices: [
        'ข้อมูลสูญหายระหว่างทาง',
        'การใช้ข้อมูลจากอนาคตหรือข้อมูลของ target ปนเข้าไปในฟีเจอร์ ทำให้โมเดลดูเก่งเกินจริง',
        'การทำ normalization ผิดพลาด',
        'การลบ outlier ออกมากเกินไป'
      ],
      answer: 1,
      explanation:
        'Data leakage คือการที่ฟีเจอร์มีข้อมูลที่ไม่มีจริงตอนทำนาย ทำให้ผลประเมินดีเกินจริงและใช้จริงไม่ได้',
      whyWrong: [
        'ไม่ใช่ความหมายของ leakage',
        null,
        'ไม่เกี่ยวกับ normalization',
        'ไม่เกี่ยวกับ outlier'
      ],
      difficulty: 2
    },
    {
      id: 'fe-005',
      subject: 'feature-engineering',
      topic: 'กับดักที่พบบ่อย',
      question: 'ข้อใดเป็นวิธีลดผลกระทบของ outlier ที่เหมาะสม',
      choices: [
        'ลบค่าที่ดูผิดปกติทันทีโดยไม่ตรวจสอบ',
        'ตรวจสอบที่มาและพิจารณาใช้เทคนิค เช่น winsorize หรือ log transform ตามความเหมาะสม',
        'ปล่อยไว้แล้วไม่ต้องทำอะไร',
        'เปลี่ยนค่าทั้งคอลัมน์ให้เป็น 0'
      ],
      answer: 1,
      explanation:
        'ควรตรวจสอบที่มาก่อน แล้วเลือกวิธีที่เหมาะ เช่น cap ค่า (winsorize) หรือแปลง log ขึ้นกับลักษณะข้อมูล',
      whyWrong: [
        'การลบทันทีอาจทำให้เสียข้อมูลจริง',
        null,
        'outlier บางครั้งส่งผลเสียต่อโมเดล',
        'ทำลายข้อมูลทั้งหมด'
      ],
      difficulty: 2
    },

    /* ---------------- AI & Digital Essentials (5) ---------------- */
    {
      id: 'ai-001',
      subject: 'ai-digital-essentials',
      topic: 'พื้นฐาน AI',
      question: 'ข้อใดอธิบาย Machine Learning ได้ถูกต้องที่สุด',
      choices: [
        'โปรแกรมที่เขียนกฎ if-else ไว้ล่วงหน้าทั้งหมด',
        'ระบบที่เรียนรู้รูปแบบจากข้อมูลเพื่อทำนายหรือตัดสินใจ โดยไม่ต้องเขียนกฎทุกอย่างด้วยมือ',
        'ระบบที่ต้องต่ออินเทอร์เน็ตตลอดเวลา',
        'ระบบจัดเก็บข้อมูลบนคลาวด์'
      ],
      answer: 1,
      explanation:
        'ML เรียนรู้ pattern จากข้อมูล (data-driven) มากกว่าการเขียนกฎตายตัว',
      whyWrong: [
        'นั่นคือ rule-based programming',
        null,
        'ไม่จำเป็นต้องต่อเน็ต',
        'นั่นคือ cloud storage'
      ],
      difficulty: 1
    },
    {
      id: 'ai-002',
      subject: 'ai-digital-essentials',
      topic: 'พื้นฐาน AI',
      question: 'Generative AI ต่างจาก AI แบบจำแนก (classification) ทั่วไปอย่างไร',
      choices: [
        'Generative AI สร้างข้อมูลใหม่ (ข้อความ รูป เสียง) ส่วน classification ทำนายคลาสจากข้อมูลที่ให้',
        'Generative AI เร็วกว่าเสมอ',
        'Generative AI ใช้ได้เฉพาะภาษาอังกฤษ',
        'classification ไม่ต้องใช้ข้อมูลฝึก'
      ],
      answer: 0,
      explanation:
        'Generative AI เน้นสร้าง content ใหม่ ส่วน classification เลือกคลาสจากข้อมูลเข้า',
      whyWrong: [
        null,
        'ความเร็วขึ้นกับงานและโมเดล',
        'รองรับหลายภาษา',
        'classification ต้องใช้ข้อมูลฝึก'
      ],
      difficulty: 1
    },
    {
      id: 'ai-003',
      subject: 'ai-digital-essentials',
      topic: 'ความปลอดภัยดิจิทัล',
      question: 'ข้อใดเป็นวิธีที่ปลอดภัยที่สุดในการจัดการรหัสผ่าน',
      choices: [
        'ใช้รหัสเดียวกันทุกเว็บเพื่อความง่าย',
        'ใช้รหัสที่คาดเดายากและไม่ซ้ำกันในแต่ละเว็บ พร้อมใช้ตัวจัดการรหัสผ่าน',
        'จดรหัสผ่านไว้ในโพสต์อิทที่ติดหน้าจอ',
        'ใช้ชื่อตัวเองเป็นรหัสผ่าน'
      ],
      answer: 1,
      explanation:
        'รหัสผ่านที่คาดเดายากและไม่ซ้ำกันช่วยลดความเสี่ยงเมื่อเว็บหนึ่งถูกเจาะ ส่วน password manager ช่วยจำให้',
      whyWrong: [
        'ถ้าเว็บหนึ่งถูกเจาะ เว็บอื่นจะถูกเจาะตาม',
        null,
        'ใครเห็นก็เข้าถึงได้',
        'คาดเดาง่ายมาก'
      ],
      difficulty: 1
    },
    {
      id: 'ai-004',
      subject: 'ai-digital-essentials',
      topic: 'ความปลอดภัยดิจิทัล',
      question: 'ฟิชชิง (phishing) คืออะไร',
      choices: [
        'การโจมตีโดยหลอกให้ผู้ใช้เปิดเผยข้อมูล เช่น ผ่านอีเมลหรือเว็บปลอม',
        'การอัปเดตซอฟต์แวร์เป็นประจำ',
        'การสำรองข้อมูลบนคลาวด์',
        'การเข้ารหัสไฟล์'
      ],
      answer: 0,
      explanation:
        'Phishing หลอกให้เหยื่อเปิดเผยข้อมูลด้วยข้อความหรือหน้าเว็บที่ดูน่าเชื่อถือ',
      whyWrong: [
        null,
        'การอัปเดตเป็นเรื่องที่ดี ไม่ใช่การโจมตี',
        'การสำรองข้อมูลไม่ใช่การโจมตี',
        'การเข้ารหัสเป็นมาตรการป้องกัน'
      ],
      difficulty: 1
    },
    {
      id: 'ai-005',
      subject: 'ai-digital-essentials',
      topic: 'การใช้ AI อย่างมีความรับผิดชอบ',
      question:
        'เมื่อใช้ AI ช่วยตอบคำถามสำคัญ ข้อใดเป็นแนวปฏิบัติที่เหมาะสมที่สุด',
      choices: [
        'เชื่อคำตอบของ AI ทันทีโดยไม่ตรวจสอบ',
        'ใช้ AI เป็นเครื่องมือช่วยคิด แล้วตรวจสอบข้อมูลกับแหล่งที่เชื่อถือได้ก่อนตัดสินใจ',
        'ไม่ควรใช้ AI เลยในทุกกรณี',
        'คัดลอกคำตอบของ AI ไปใช้โดยไม่อ้างอิง'
      ],
      answer: 1,
      explanation:
        'AI อาจผิดพลาดได้ ควรใช้เป็นตัวช่วยและตรวจสอบกับแหล่งข้อมูลที่เชื่อถือได้เสมอ',
      whyWrong: [
        'AI อาจ hallucinate ได้',
        null,
        'AI มีประโยชน์เมื่อใช้อย่างเหมาะสม',
        'ควรอ้างอิงเมื่อนำไปใช้'
      ],
      difficulty: 1,
      noShuffle: true
    }
  ];
})();