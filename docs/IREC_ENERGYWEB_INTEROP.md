# I-REC / Energy Web Interoperability Requirements

> Research for SolarProof — Level 3 roadmap item (see README Product Levels)

---

## 1. Context

SolarProof currently mints its own on-chain energy certificates (1 token = 1 kWh) anchored to Stellar. To gain acceptance in established corporate procurement and regulatory markets, SolarProof certificates need to be **bridged to or recognised by**:

- **I-REC(E)** — the International Renewable Energy Certificate standard, administered by I-TRACK Foundation / Evident registry (used in 50+ countries)
- **Energy Web Origin** — an open-source SDK + EW-Chain marketplace for Energy Attribute Certificates (EACs)

This document summarises the technical and procedural requirements for interoperability.

---

## 2. I-REC(E) Interoperability

### 2.1 How I-REC works

1. A **production device** (solar plant, wind farm) is registered with an accredited **Issuer** in its country.
2. The Issuer verifies meter data and issues I-REC(E) certificates in the **Evident registry** (1 I-REC = 1 MWh).
3. Certificates are transferred to buyers and **redeemed** (retired) against a specific time period and beneficiary.
4. Each I-REC carries: unique ID, device ID, country, energy source, production period (start/end), volume (MWh), issuance date, issuer.

### 2.2 Technical integration path

| Step | Requirement | SolarProof gap |
|------|-------------|---------------|
| Device registration | Register each cooperative's solar installation with an accredited I-REC Issuer; provide device capacity, location, technology, commissioning date | Need device registry with lat/lon, capacity (kW), tech type fields |
| MRV data submission | Submit independently-verified meter readings to Issuer (PDF or API); readings must be MWh-granularity (not kWh) | SolarProof readings are kWh — need aggregation to MWh before submission |
| Certificate issuance | Issuer calls Evident API to mint I-RECs; SolarProof cannot mint I-RECs directly | Bridge role: SolarProof acts as MRV data provider, Issuer mints I-RECs |
| API integration | Evident supports REST API for registered users (account, devices, certificates, transfers, redemptions) | Need Evident API credentials + OAuth; map SolarProof `certificates` to Evident payload |
| Redemption | Buyer redeems via Evident registry; SolarProof on-chain retirement must be linked to Evident redemption ID | Add `irec_redemption_id` field to `certificates` table |

### 2.3 Required data fields (I-REC device registration)

```
deviceId         string   unique identifier in SolarProof
country          string   ISO 3166-1 alpha-2
fuelType         string   "Solar" | "Wind" | "Hydro" | ...
technology       string   e.g. "Photovoltaic"
capacity         number   installed capacity in kW
commissionDate   date     YYYY-MM-DD
location         object   { lat, lon, address }
registrantId     string   Evident account ID of the cooperative
```

### 2.4 Required data fields (I-REC issuance request)

```
deviceId         string
productionStart  datetime  ISO 8601
productionEnd    datetime  ISO 8601
volume           number     MWh (aggregated from SolarProof kWh readings)
mrvDocumentUrl   string     link to independently-verified meter data
```

### 2.5 Key gap: granularity

I-REC issues per **MWh**. SolarProof meters report per **reading** (sub-kWh precision). The bridge must aggregate readings into monthly MWh batches before submitting to Evident.

### 2.6 Key gap: cryptographic proof not required by I-REC

I-REC does not currently require or validate cryptographic proofs (Ed25519 signatures). SolarProof's signed readings are **additional assurance** but cannot be submitted to Evident in lieu of the standard MRV process. This is SolarProof's differentiator: the cryptographic anchor proves to buyers that the MRV data was not tampered with between meter and Issuer.

---

## 3. Energy Web Origin Interoperability

### 3.1 How Energy Web Origin works

- Built on **Energy Web Chain (EW-Chain)** — a Proof-of-Authority EVM chain purpose-built for energy.
- Core component: **Traceability SDK** — issues EACs as ERC-1888 tokens (fractional certificates).
- Each EAC token carries: device ID, energy source, generation start/end, volume (Wh), issuer address.
- Certificates can be traded via the **Trade SDK** (order book on EW-Chain) and claimed (retired) by buyers.

### 3.2 Technical integration path

| Step | Requirement | SolarProof gap |
|------|-------------|---------------|
| Device registry | Register meter devices via EW Origin Device Registry SDK | Need to map SolarProof `meters` + `cooperatives` to EW device schema |
| Certificate issuance | Call `IssuanceService.issue()` with EW Origin Traceability SDK | SolarProof API must call EW-Chain in addition to (or instead of) Stellar; dual-chain or bridge needed |
| ERC-1888 token | EAC token must carry `deviceId`, `generationStartTime`, `generationEndTime`, `certificationRequestId` | SolarProof Soroban `energy_token` is SEP-41 (Stellar), not ERC-1888; not directly compatible |
| Proof attachment | EW Origin does not natively support Ed25519 proofs; could be embedded in certificate metadata | Add `proofUri` or IPFS CID of the SolarProof anchor tx to the EAC token metadata |
| Trading | Use EW Trade SDK order book | Out of scope for initial bridge |

### 3.3 EW Origin EAC data schema

```typescript
interface EACIssuanceRequest {
  deviceId: string           // registered EW Origin device
  generationStartTime: number  // Unix timestamp
  generationEndTime: number    // Unix timestamp
  energy: number             // Wh
  metadata?: string          // JSON string — can embed SolarProof anchor tx hash here
}
```

### 3.4 Key gap: dual-chain architecture

SolarProof is Stellar-native. Energy Web Origin is EVM-native (EW-Chain). A bridge requires:
- A service account with EW-Chain gas (EWT tokens)
- A signing key authorised by an EW Origin Issuer
- A mapping layer from Stellar `energy_token` → ERC-1888 EAC

This is non-trivial and warrants a dedicated bridge microservice.

---

## 4. Comparison: I-REC vs Energy Web for SolarProof

| Dimension | I-REC(E) | Energy Web Origin |
|-----------|----------|-------------------|
| Market reach | 50+ countries, dominant corporate procurement standard | Primarily EU / Energy Web ecosystem |
| Token standard | Off-chain registry (Evident) | ERC-1888 on EW-Chain |
| Crypto-native | No — registry is centralised | Yes — on-chain tokens |
| MRV granularity | MWh (monthly batches) | Wh (high-granularity) |
| Integration complexity | Medium — REST API to Evident | High — EVM bridge required |
| Cryptographic proof support | None natively | Metadata field (extensible) |
| Priority for SolarProof | **High** — needed for corporate buyers | Medium — relevant for EW ecosystem |

---

## 5. Recommended implementation approach

### Phase 1: I-REC bridge (Priority: High)

1. Add `irec_device_id`, `irec_redemption_id` columns to `meters` and `certificates` tables.
2. Build a `POST /api/irec/submit-batch` endpoint that aggregates readings by device/month into MWh, formats the Evident API payload, and calls Evident to request issuance.
3. On successful I-REC issuance, store the `irec_certificate_id` on the SolarProof certificate record.
4. Surface the I-REC ID on the public verifier page (`/verify`) so buyers can cross-reference.

### Phase 2: Energy Web bridge (Priority: Medium)

1. Deploy a bridge microservice (Node.js + ethers.js) that watches for new SolarProof `certificates` on Stellar.
2. On each new certificate, call `IssuanceService.issue()` on EW-Chain with energy volume + SolarProof anchor tx hash in metadata.
3. Store returned ERC-1888 token ID on the SolarProof certificate record.

### Phase 3: Cryptographic proof as differentiator (Future)

- Advocate with I-TRACK Foundation to add optional cryptographic proof fields to the I-REC(E) standard.
- SolarProof's Ed25519 anchored readings are well-positioned as a reference implementation for tamper-evident MRV.

---

## 6. Open questions

1. **Evident API access** — requires registering SolarProof (or cooperatives) as Evident users. Who is the legal Registrant entity?
2. **Accredited Issuer** — SolarProof cannot issue I-RECs itself; it must work with an accredited Issuer in each country. Which Issuer partner(s) to approach first?
3. **MRV independence** — I-REC requires meter data to be "independently verified." Does the Ed25519 signature + Stellar anchor satisfy Issuers as MRV evidence, or is a third-party inspection still required?
4. **EWT gas** — for EW-Chain integration, who funds the EWT gas account?
5. **Token retirement coordination** — if a certificate is retired on both SolarProof (Stellar) and I-REC (Evident), how is double-counting prevented?

---

## 7. References

- I-TRACK Foundation — International Attribute Tracking Standard: https://www.trackingstandard.org/the-standard/
- I-REC(E) Product Code (Evident): https://www.trackingstandard.org/product-code/electricity/
- Guidance for API Integration with Evident Registry: https://www.trackingstandard.org/guidance-for-api-integration-with-evident-registry-for-i-rece/
- Energy Web Origin documentation: https://energy-web-foundation-origin.readthedocs-hosted.com/
- EW Origin GitHub (Traceability SDK): https://github.com/energywebfoundation/origin
- Hedera Guardian I-REC demo guide: https://guardian.hedera.com/guardian/demo-guide/renewable-energy-credits/introduction-to-international-renewable-energy-credit-standard-irec
