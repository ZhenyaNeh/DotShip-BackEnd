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
  Button,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface ConfirmationTemplateProps {
  domain: string;
  token: string;
  userName?: string;
  companyName?: string;
}

export function ConfirmationTemplate({
  domain,
  token,
  userName = "User",
  companyName = "DotShip"
}: ConfirmationTemplateProps) {
  const confirmLink = `${domain}/auth/new-verification?token=${token}`;

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: {
                50: '#f0f9ff',
                100: '#e0f2fe',
                500: '#0ea5e9',
                600: '#0284c7',
                700: '#0369a1',
              },
            },
          },
        },
      }}
    >
      <Html>
        <Head />
        <Preview>Confirm your email address for {companyName}</Preview>
        <Body className="bg-gray-50 font-sans py-8 px-2">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm mx-auto p-8 max-w-2xl">
            
            {/* Логотип и приветствие */}
            <Section className="mb-8 text-center">
              <Heading as="h1" className="text-2xl font-bold text-gray-800 mb-2">
                Confirm Your Email
              </Heading>
              <Text className="text-gray-600">
                Hello {userName}, welcome to {companyName}!
              </Text>
            </Section>

            {/* Основное содержимое */}
            <Section className="mb-8">
              <Text className="text-gray-700 mb-6">
                Thank you for signing up! To complete your registration and verify your email address, please click the confirmation button below.
              </Text>
              
              <div className="text-center mb-6">
                <Button
                  href={confirmLink}
                  className="bg-brand-600 px-6 py-3 rounded-md text-white font-semibold text-center inline-block"
                >
                  Confirm Email Address
                </Button>
              </div>

              <Text className="text-gray-500 text-sm mb-6 text-center">
                Or copy and paste this URL into your browser: <br />
                <Link href={confirmLink} className="text-brand-500 break-all">
                  {confirmLink}
                </Link>
              </Text>
            </Section>

            {/* Дополнительная информация */}
            <Section className="bg-gray-50 rounded-lg p-4 mb-8">
              <Text className="text-gray-600 text-sm font-semibold mb-2">Important:</Text>
              <Text className="text-gray-600 text-sm">
                This link is valid for 1 hour. If you did not request this confirmation email, 
                please ignore this message or contact our support team if you have concerns.
              </Text>
            </Section>

            <Hr className="border-gray-200 my-6" />

            {/* Футер */}
            <Section className="text-center text-gray-500 text-xs">
              <Text className="mb-2">
                Need help? Contact our support team or visit our Help Center
              </Text>
              <Row>
                <Column className="text-left">
                  <Text>© {new Date().getFullYear()} {companyName}</Text>
                </Column>
                <Column className="text-right">
                  <Link href="#" className="text-brand-500 mr-4">Privacy Policy</Link>
                  <Link href="#" className="text-brand-500">Terms of Service</Link>
                </Column>
              </Row>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}