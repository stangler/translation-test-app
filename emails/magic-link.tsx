import {
  Html,
  Body,
  Container,
  Text,
  Link,
  Heading,
  Section,
} from "@react-email/components";

interface MagicLinkEmailProps {
  url: string;
  email: string;
}

export default function MagicLinkEmail({ url, email }: MagicLinkEmailProps) {
  return (
    <Html>
      <Body
        style={{
          fontFamily: "Arial, sans-serif",
          padding: "40px 20px",
          background: "#f5f5f5",
        }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "12px",
            padding: "32px",
          }}
        >
          <Heading
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            📖 英語練習テストにログイン
          </Heading>
          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.6",
              color: "#333",
              marginBottom: "24px",
            }}
          >
            以下のリンクをクリックしてログインしてください。このリンクは24時間有効です。
          </Text>
          <Section style={{ textAlign: "center", marginBottom: "24px" }}>
            <Link
              href={url}
              style={{
                display: "inline-block",
                padding: "12px 32px",
                background: "#e53e3e",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              ログインする
            </Link>
          </Section>
          <Text style={{ fontSize: "12px", color: "#888", lineHeight: "1.4" }}>
            このメールに心当たりがない場合は、このメールを無視してください。
            <br />
            送信先: {email}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
