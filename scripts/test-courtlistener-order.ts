#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.COURTLISTENER_API_KEY || 'cc4a34d0ce5e2e173dc4ca56972ed1b6c252b3b1';
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4';

async function testOrderBy() {
  console.log('\n🔍 Testing order_by parameter...\n');
  
  // Test 1: With problematic order_by
  console.log('Test 1: With order_by=-cluster__date_filed,id');
  const params1 = new URLSearchParams({
    q: 'death penalty Texas',
    type: 'o',
    format: 'json',
    page_size: '5',
    order_by: '-cluster__date_filed,id'
  });
  
  const url1 = `${BASE_URL}/search/?${params1}`;
  console.log('URL:', url1);
  
  try {
    const response1 = await fetch(url1, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    console.log('Status:', response1.status, response1.statusText);
    const data1 = await response1.json();
    console.log('Results count:', data1.count || 0);
    console.log('Error:', data1.error || 'None');
  } catch (error) {
    console.error('Request error:', error);
  }
  
  // Test 2: With correct order_by
  console.log('\n\nTest 2: With order_by=dateFiled desc');
  const params2 = new URLSearchParams({
    q: 'death penalty Texas',
    type: 'o',
    format: 'json',
    page_size: '5',
    order_by: 'dateFiled desc'
  });
  
  const url2 = `${BASE_URL}/search/?${params2}`;
  console.log('URL:', url2);
  
  try {
    const response2 = await fetch(url2, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    console.log('Status:', response2.status, response2.statusText);
    const data2 = await response2.json();
    console.log('Results count:', data2.count || 0);
  } catch (error) {
    console.error('Request error:', error);
  }
  
  // Test 3: With no order_by
  console.log('\n\nTest 3: Without order_by parameter');
  const params3 = new URLSearchParams({
    q: 'death penalty Texas',
    type: 'o',
    format: 'json',
    page_size: '5'
  });
  
  const url3 = `${BASE_URL}/search/?${params3}`;
  console.log('URL:', url3);
  
  try {
    const response3 = await fetch(url3, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_KEY}`
      }
    });
    
    console.log('Status:', response3.status, response3.statusText);
    const data3 = await response3.json();
    console.log('Results count:', data3.count || 0);
  } catch (error) {
    console.error('Request error:', error);
  }
}

testOrderBy().catch(console.error);