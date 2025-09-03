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

interface ResetPasswordTemplateProps {
  domain: string;
  token: string;
  userName?: string;
  companyName?: string;
}

export function ResetPasswordTemplate({ 
  domain, 
  token, 
  userName = "User", 
  companyName = "DotShip" 
}: ResetPasswordTemplateProps) {
  const resetLink = `${domain}/auth/new-password?token=${token}`;

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
              danger: {
                100: '#fee2e2',
                500: '#ef4444',
                600: '#dc2626',
              }
            },
          },
        },
      }}
    >
      <Html>
        <Head />
        <Preview>Reset your password for {companyName}</Preview>
        <Body className="bg-gray-50 font-sans py-8 px-2">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm mx-auto p-8 max-w-2xl">
            
            {/* Заголовок */}
            <Section className="mb-8 text-center">
              <Heading as="h1" className="text-2xl font-bold text-gray-800 mb-2">
                Password Reset Request
              </Heading>
              <Text className="text-gray-600">
                Hello {userName}, we received a request to reset your password
              </Text>
            </Section>

            {/* Основное содержимое */}
            <Section className="mb-8">
              <Text className="text-gray-700 mb-6">
                Click the button below to create a new password for your account. This will allow you to securely access your account with a new password.
              </Text>
              
              <div className="text-center mb-6">
                <Button
                  href={resetLink}
                  className="bg-danger-500 px-6 py-3 rounded-md text-white font-semibold text-center inline-block"
                >
                  Reset Password
                </Button>
              </div>

              <Text className="text-gray-500 text-sm mb-6 text-center">
                Or copy and paste this URL into your browser: <br />
                <Link href={resetLink} className="text-brand-500 break-all">
                  {resetLink}
                </Link>
              </Text>
            </Section>

            {/* Важная информация */}
            <Section className="bg-danger-100 rounded-lg p-4 mb-8">
              <Text className="text-danger-600 text-sm font-semibold mb-2">Important security information:</Text>
              <Text className="text-danger-600 text-sm">
                This link will expire in 1 hour for your security. If you didn't request this password reset, 
                please ignore this email and consider securing your account as your email may be compromised.
              </Text>
            </Section>

            <Hr className="border-gray-200 my-6" />

            {/* Футер */}
            <Section className="text-center text-gray-500 text-xs">
              <Text className="mb-2">
                Need help? Contact our support team
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