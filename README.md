

## Inputs

| Name                | Type     | Description                               |
|---------------------|----------|-------------------------------------------|
| `base-image`        | String   | Docker image used in the FROM instruction |
| `user-image`        | String   | Docker image that needs to be checked     |

## Output

| Name            | Type    | Description                                               |
|-----------------|---------|-----------------------------------------------------------|
| `result`        | Boolean | `true` if update is required, otherwise `false`           |


## Usage

```yaml
name: Check if the base Docker image has changed and then rebuild it

on: [push]

jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      result: ${{ steps.check.outputs.result }}
    steps:
      -
        name: Check
        id: check
        uses: kyzima-spb/docker-image-need-update-action@v1
        with:
          base-image: debian:bookworm-slim
          user-image: kyzimaspb/tixati
  
  build:
    needs: check
    if: ${{ needs.check.outputs.result }}
    runs-on: ubuntu-latest
    steps:
      -
        name: Rebuild Image
        run: echo "Need rebuild image"
```