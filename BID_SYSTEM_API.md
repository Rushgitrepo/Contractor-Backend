# ContractorList Bid System API Specification

## Overview
This API manages the bidding lifecycle for the ContractorList platform. It supports General Contractors (GC) and Subcontractors (SC) submitting bids on projects, and Project Owners managing those bids.

**Base URL**: `/api/v1`

## Authentication & Authorization
- **Auth**: Bearer Token (JWT) required for all endpoints.
- **Roles**:
  - `Contractor`: Can create, update (draft), submit, and withdraw their own bids.
  - `Project Owner`: Can view all bids on their projects, accept, or reject bids.

## Status Flow
1. `draft` -> `submitted`: Contractor submits the bid.
2. `submitted` -> `accepted`: Owner accepts the bid.
3. `submitted` -> `rejected`: Owner rejects the bid.
4. `submitted` / `accepted` -> `withdrawn`: Contractor withdraws the bid.

---

## Endpoints

### 1. Create Bid (Draft)
Creates a new bid in `draft` status. A contractor can only have one active bid per project.

- **URL**: `/bids`
- **Method**: `POST`
- **Role**: Contractor (GC or SC)
- **Request Body**:
  ```json
  {
    "projectId": "uuid",
    "totalPrice": 15000.00,
    "estimatedStartDate": "2023-11-01",
    "estimatedEndDate": "2023-12-01",
    "notes": "Includes all labor and materials.",
    "items": [ // Optional initial items
      {
        "name": "Material Cost",
        "description": "Lumber and screws",
        "price": 5000.00
      },
      {
        "name": "Labor",
        "price": 10000.00
      }
    ]
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "projectId": "uuid",
      "contractorId": 123,
      "contractorType": "gc",
      "status": "draft",
      "totalPrice": 15000.00,
      "createdAt": "2023-10-01T10:00:00Z"
    }
  }
  ```

---

### 2. Update Bid Items
Replaces all items for a specific bid. Only allowed if bid status is `draft`.

- **URL**: `/bids/:id/items`
- **Method**: `PUT`
- **Role**: Contractor (Owner of bid)
- **Request Body**:
  ```json
  {
    "items": [
      {
        "name": "Material Cost Updated",
        "description": "Premium lumber",
        "price": 6000.00
      },
      {
        "name": "Labor",
        "price": 10000.00
      }
    ]
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "count": 2,
      "totalCalculated": 16000.00 // Server should validate total matches sum of items
    }
  }
  ```

---

### 3. Submit Bid
Changes status from `draft` to `submitted`. Locks the bid from further edits.

- **URL**: `/bids/:id/submit`
- **Method**: `POST`
- **Role**: Contractor (Owner of bid)
- **Request Body**: (Empty)
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "status": "submitted",
      "submittedAt": "2023-10-02T12:00:00Z"
    }
  }
  ```

---

### 4. Withdraw Bid
Changes status to `withdrawn`. Can be done from `submitted` or `accepted` (with restrictions/warnings if accepted).

- **URL**: `/bids/:id/withdraw`
- **Method**: `POST`
- **Role**: Contractor (Owner of bid)
- **Request Body**:
  ```json
  {
    "reason": "Scheduling conflict"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "status": "withdrawn"
    }
  }
  ```

---

### 5. Accept Bid
Changes status to `accepted`. Only the Project Owner can perform this. This may trigger other system events (e.g., rejecting other bids, notifying parties).

- **URL**: `/bids/:id/accept`
- **Method**: `POST`
- **Role**: Project Owner
- **Request Body**: (Empty)
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "status": "accepted",
      "projectId": "uuid"
    }
  }
  ```

---

### 6. Reject Bid
Changes status to `rejected`.

- **URL**: `/bids/:id/reject`
- **Method**: `POST`
- **Role**: Project Owner
- **Request Body**:
  ```json
  {
    "reason": "Price too high"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "status": "rejected"
    }
  }
  ```

---

### 7. Get Project Bids (Owner View)
Retrieves all bids for a specific project. Only accessible by the Project Owner.

- **URL**: `/projects/:projectId/bids`
- **Method**: `GET`
- **Role**: Project Owner
- **Query Params**:
  - `status`: Filter by status (e.g., `submitted`)
  - `sort`: `price_asc`, `date_desc`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "contractor": { "id": 123, "name": "ABC Construction", "rating": 4.8 },
        "totalPrice": 15000.00,
        "status": "submitted",
        "estimatedStartDate": "2023-11-01"
      }
      // ... more bids
    ]
  }
  ```

---

### 8. Get My Bids (Contractor View)
Retrieves all bids submitted by the logged-in contractor.

- **URL**: `/bids/my-bids`
- **Method**: `GET`
- **Role**: Contractor
- **Query Params**:
  - `status`: Filter by status
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "projectTitle": "Downtown Renovation",
        "totalPrice": 15000.00,
        "status": "draft",
        "createdAt": "2023-10-01"
      }
    ]
  }
  ```

---

### 9. Get Bid Detail
Retrieves full details of a bid, including line items and status log.

- **URL**: `/bids/:id`
- **Method**: `GET`
- **Role**: Project Owner (if bid is on their project) OR Contractor (if they own the bid)
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "project": { "id": "uuid", "title": "Project X" },
      "contractor": { "id": 123, "name": "Me" },
      "totalPrice": 15000.00,
      "status": "submitted",
      "estimatedStartDate": "2023-11-01",
      "notes": "Notes here",
      "items": [
        { "name": "Item 1", "price": 100.00 }
      ],
      "history": [
        { "status": "draft", "changedAt": "..." },
        { "status": "submitted", "changedAt": "..." }
      ]
    }
  }
  ```
