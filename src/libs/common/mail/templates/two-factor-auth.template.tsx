/* eslint-disable prettier/prettier */
import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Html,
  // Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface TwoFactorAuthTemplateProps {
  token: string;
  userName?: string;
  companyName?: string;
}

export function TwoFactorAuthTemplate({ 
  token, 
  userName = "User", 
  companyName = "DotShip" 
}: TwoFactorAuthTemplateProps) {
  // Форматируем токен для лучшей читаемости
  const formattedToken = token.match(/.{1,3}/g)?.join(' ') || token;

  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>Your two-factor authentication code for {companyName}</Preview>
        <Body className="bg-gray-50 font-sans py-8 px-2">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm mx-auto p-8 max-w-2xl">
            <Section className="mb-8 text-center">
              <Heading as="h1" className="text-2xl font-bold text-gray-800 mb-2">
                Two-Factor Authentication
              </Heading>
              <Text className="text-gray-600">
                Hello {userName}, here is your verification code
              </Text>
            </Section>

            <Section className="mb-8 text-center">
              <Text className="text-sm text-gray-500 mb-4">Your verification code</Text>
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 mx-auto inline-block">
                <Text className="text-3xl font-bold text-gray-800 tracking-widest">
                  {formattedToken}
                </Text>
              </div>
              <Text className="text-xs text-gray-500 mt-2">
                This code will expire in 10 minutes
              </Text>
            </Section>

            <Section className="mb-8">
              <Text className="text-gray-700 mb-4">
                Please enter this code in the verification screen to complete your login.
              </Text>
              <Text className="text-gray-700">
                If you didn't request this code, please ignore this message or contact support if you have concerns.
              </Text>
            </Section>

            <Section className="text-center text-gray-500 text-xs">
              <Text className="mb-2">
                Sent by {companyName}
              </Text>
              <Text className="mb-4">
                Need help? Contact our support team
              </Text>
              <Row>
                <Column className="text-left">
                  <Text>© {new Date().getFullYear()} {companyName}</Text>
                </Column>
                <Column className="text-right">
                  <Link href="#" className="text-blue-500 mr-4">Privacy Policy</Link>
                  <Link href="#" className="text-blue-500">Terms of Service</Link>
                </Column>
              </Row>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}